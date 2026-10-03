import { FileSystem, Path } from '@effect/platform';
import { Effect, Option } from 'effect';
import { posix } from 'node:path';
import { parse as parseYaml, YAMLError } from 'yaml';
import { ContainerConfigError } from './errors';
import {
  CONTAINER_ENTRYPOINT_PREFIX,
  CONTAINER_RUNTIME,
  DEFAULT_CONTAINER_MEMORY_MB,
  DEFAULT_FUNCTION_DURATION_SECONDS,
  DEFAULT_SIDECAR_MEMORY_MB,
  MAX_SIDECARS,
  type NormalizedConfigEntrypoint,
  type NormalizedContainerImageSource,
  type NormalizedContainerSpec,
  type NormalizedSidecar,
} from './normalized-config';
import type { ConfigV4Container, ConfigV4ContainerBuild } from './v4';

/** Compose file names, in the order `docker compose` looks for them. */
export const COMPOSE_FILE_NAMES = ['compose.yaml', 'compose.yml', 'docker-compose.yaml', 'docker-compose.yml'] as const;

/**
 * Valid container name, which is also the hostname a sidecar answers to. It
 * starts with a letter so that no name (`1234`) reads as an IPv4 literal before
 * `/etc/hosts` is consulted. Mirrors the v4 schema and the network decoder.
 */
const CONTAINER_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,62}$/;

/** Rules a container name breaks, phrased for error messages. */
const CONTAINER_NAME_RULES =
  "1 to 63 lowercase letters, digits, '-' or '_', starting with a letter, and not 'localhost'";

/** Memory bounds of a container, in MB. Mirrors the v4 schema. */
const MIN_CONTAINER_MEMORY_MB = 128;
const MAX_CONTAINER_MEMORY_MB = 3009;

/** Bounds of the container environment. Mirror the v4 schema. */
const MAX_CONTAINER_ENV_VARS = 100;
const MAX_CONTAINER_ENV_VALUE_LENGTH = 65_536;

/**
 * Returns the synthetic entrypoint path of a container function, which routes
 * use as their `destination`.
 *
 * @example
 * ```ts
 * containerEntrypointPath('web'); // 'container:web'
 * ```
 */
export const containerEntrypointPath = (name: string): string => `${CONTAINER_ENTRYPOINT_PREFIX}${name}`;

/**
 * Turns an arbitrary label into a valid container name: lowercased, runs of
 * other characters replaced with `-`, and `app-` in front when it would not
 * start with a letter. An empty result, or `localhost`, becomes `app`.
 */
const toContainerName = (raw: string): string => {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[^a-z0-9]+/, '');
  const name = (cleaned === '' || /^[a-z]/.test(cleaned) ? cleaned : `app-${cleaned}`).slice(0, 63);
  return name === '' || name === 'localhost' ? 'app' : name;
};

/**
 * Derives the container name of a `functions` entry that runs a Dockerfile
 * (`runtime: docker`): the directory the Dockerfile sits in, plus any suffix
 * or prefix around `Dockerfile` in its file name. A root `Dockerfile` is `app`,
 * and a name that would not start with a letter gets an `app-` prefix.
 *
 * @param file - Project-relative path of the Dockerfile
 * @returns A valid container name
 * @example
 * ```ts
 * dockerFunctionContainerName('Dockerfile'); // 'app'
 * dockerFunctionContainerName('services/api/Dockerfile'); // 'api'
 * dockerFunctionContainerName('docker/worker.Dockerfile'); // 'docker-worker'
 * dockerFunctionContainerName('services/1/Dockerfile'); // 'app-1'
 * ```
 */
export const dockerFunctionContainerName = (file: string): string => {
  const { dir, base } = posix.parse(file);
  const variant = base.replace(/^Dockerfile[.-]?/i, '').replace(/[.-]?Dockerfile$/i, '');
  const raw = [posix.basename(dir), variant === base ? posix.parse(base).name : variant]
    .filter((part) => part !== '')
    .join('-');
  return toContainerName(raw);
};

/**
 * Splits a command string into words the way Compose does: whitespace
 * separates words, single and double quotes group them, and a backslash
 * escapes the next character outside single quotes. No shell runs.
 *
 * @param input - Command as written, e.g. `redis-server --save ""`
 * @returns The argv words
 * @throws Error when a quote is left open
 * @example
 * ```ts
 * splitCommandWords('sh -c "echo hi"'); // ['sh', '-c', 'echo hi']
 * ```
 */
export const splitCommandWords = (input: string): string[] => {
  const words: string[] = [];
  let current = '';
  let inWord = false;
  let quote: "'" | '"' | undefined;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (quote === "'") {
      if (char === "'") quote = undefined;
      else current += char;
    } else if (char === '\\' && index + 1 < input.length) {
      index += 1;
      current += input[index];
      inWord = true;
    } else if (quote === '"') {
      if (char === '"') quote = undefined;
      else current += char;
    } else if (char === "'" || char === '"') {
      quote = char;
      inWord = true;
    } else if (/\s/.test(char)) {
      if (inWord) words.push(current);
      current = '';
      inWord = false;
    } else {
      current += char;
      inWord = true;
    }
  }

  if (quote) throw new Error(`Unterminated ${quote} quote`);
  if (inWord) words.push(current);
  return words;
};

/**
 * Normalizes a project-relative path and refuses one that leaves the project.
 *
 * @returns The normalized POSIX path (`.` for the root), or `undefined` when it escapes
 */
const normalizeProjectPath = (input: string): string | undefined => {
  if (posix.isAbsolute(input)) return undefined;
  const normalized = posix.normalize(input.replace(/\\/g, '/')).replace(/\/+$/, '') || '.';
  if (normalized === '..' || normalized.startsWith('../')) return undefined;
  return normalized;
};

/** Real path of the project root, so that a project reached through a symbolic link still contains its own files. */
const resolveProjectRoot = (projectFolder: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fs) =>
    fs.realPath(projectFolder).pipe(Effect.orElseSucceed(() => projectFolder))
  );

/**
 * Resolves a project-relative path through every symbolic link on the way and
 * refuses a target outside the project. Checking the path string alone is not
 * enough: a committed `app.env -> /proc/self/environ` or a Dockerfile linked to
 * `~/.aws/credentials` would otherwise pull files of the machine that reads the
 * config into the deployment.
 *
 * @param projectRoot - Real path of the project root
 * @param projectRelative - Normalized project-relative path
 * @param subject - What the path is, for the error message, e.g. `Compose file 'compose.yaml'`
 * @returns The real path, or `None` when nothing exists there
 */
const resolveInsideProject = (
  projectRoot: string,
  projectRelative: string,
  subject: string,
  context: { containerName?: string; filePath?: string }
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathSvc = yield* Path.Path;
    const resolved = yield* fs.realPath(pathSvc.join(projectRoot, projectRelative)).pipe(Effect.option);
    if (Option.isNone(resolved)) return resolved;
    const relative = pathSvc.relative(projectRoot, resolved.value);
    if (relative === '..' || relative.startsWith(`..${pathSvc.sep}`) || pathSvc.isAbsolute(relative)) {
      return yield* new ContainerConfigError({
        message: `${subject} leads through a symbolic link to a location outside the project. Only files inside the project can be deployed.`,
        ...context,
      });
    }
    return resolved;
  });

/** Reads a project file through {@link resolveInsideProject}. `None` when it does not exist or cannot be read. */
const readInsideProject = (
  projectRoot: string,
  projectRelative: string,
  subject: string,
  context: { containerName?: string; filePath?: string }
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const resolved = yield* resolveInsideProject(projectRoot, projectRelative, subject, context);
    if (Option.isNone(resolved)) return Option.none<string>();
    return yield* fs.readFileString(resolved.value).pipe(Effect.option);
  });

const toArgv = (name: string, key: 'entrypoint' | 'command', value: string | string[] | undefined) =>
  value === undefined
    ? Effect.succeed(undefined)
    : Array.isArray(value)
      ? Effect.succeed(value)
      : Effect.try({
          try: () => splitCommandWords(value),
          catch: (error) =>
            new ContainerConfigError({
              message: `Container '${name}' has an invalid ${key}: ${error instanceof Error ? error.message : String(error)}`,
              containerName: name,
            }),
        });

const isIntegerBetween = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max;

/**
 * Applies the v4 schema's bounds to one container. A service imported from
 * Compose never passes the schema, so this is what makes it fail as early and
 * as clearly as a `containers` entry would. The network decoder enforces the
 * same bounds. Messages name keys but never echo environment values.
 */
const validateContainer = (name: string, container: ConfigV4Container) => {
  const build = typeof container.build === 'object' ? container.build : undefined;
  const buildArgs = Object.values(build?.args ?? {});
  const env = Object.entries(container.env ?? {});
  const user = container.user === undefined ? undefined : String(container.user);
  const badEnvKey = env.find(([key]) => key === '' || key.includes('=') || key.includes('\0'))?.[0];
  const longEnvKey = env.find(([, value]) => value.length > MAX_CONTAINER_ENV_VALUE_LENGTH)?.[0];

  const problem = (
    [
      [
        container.image !== undefined && !/^\S{1,512}$/.test(container.image),
        'has an invalid image reference. Use 1 to 512 characters without whitespace.',
      ],
      [
        container.port !== undefined && !isIntegerBetween(container.port, 1, 65_535),
        `listens on port ${container.port}. Use a whole number from 1 to 65535.`,
      ],
      [
        container.memory !== undefined &&
          !isIntegerBetween(container.memory, MIN_CONTAINER_MEMORY_MB, MAX_CONTAINER_MEMORY_MB),
        `asks for ${container.memory} MB of memory. Use a whole number from ${MIN_CONTAINER_MEMORY_MB} to ${MAX_CONTAINER_MEMORY_MB}.`,
      ],
      [
        container.working_dir !== undefined &&
          !(container.working_dir.startsWith('/') && container.working_dir.length <= 1024),
        `sets working_dir '${container.working_dir}', which must be an absolute path of at most 1024 characters.`,
      ],
      [
        typeof container.user === 'number' && !isIntegerBetween(container.user, 0, Number.MAX_SAFE_INTEGER),
        `sets user ${container.user}. A numeric user must be a non-negative whole number.`,
      ],
      [
        user !== undefined && (user.length === 0 || user.length > 256),
        'sets an empty or overlong user. Use 1 to 256 characters: a name, a uid, name:group or uid:gid.',
      ],
      [
        build?.target !== undefined && (build.target.length === 0 || build.target.length > 128),
        'has an empty build target or one longer than 128 characters.',
      ],
      [
        buildArgs.length > MAX_CONTAINER_ENV_VARS ||
          buildArgs.some((value) => value.length > MAX_CONTAINER_ENV_VALUE_LENGTH),
        `sets more than ${MAX_CONTAINER_ENV_VARS} build args, or one longer than ${MAX_CONTAINER_ENV_VALUE_LENGTH} characters.`,
      ],
      [
        env.length > MAX_CONTAINER_ENV_VARS,
        `sets ${env.length} environment variables. At most ${MAX_CONTAINER_ENV_VARS} are allowed.`,
      ],
      [
        badEnvKey !== undefined,
        `sets an environment variable named '${badEnvKey}'. Names must be non-empty and contain no '='.`,
      ],
      [
        longEnvKey !== undefined,
        `sets environment variable '${longEnvKey}' to a value longer than ${MAX_CONTAINER_ENV_VALUE_LENGTH} characters.`,
      ],
    ] satisfies Array<[boolean, string]>
  ).find(([failed]) => failed)?.[1];

  return problem === undefined
    ? Effect.void
    : Effect.fail(new ContainerConfigError({ message: `Container '${name}' ${problem}`, containerName: name }));
};

/**
 * Resolves one `containers` entry into the image spec the deployment builds.
 * The build context and Dockerfile must exist inside the project, also after
 * following symbolic links.
 */
const toContainerSpec = Effect.fn('toContainerSpec')(function* (
  name: string,
  container: ConfigV4Container,
  projectFolder: string
) {
  yield* validateContainer(name, container);

  let source: NormalizedContainerImageSource;
  if (container.image !== undefined && container.build === undefined) {
    source = { type: 'registry', reference: container.image };
  } else if (container.build !== undefined && container.image === undefined) {
    const build: ConfigV4ContainerBuild =
      typeof container.build === 'string' ? { context: container.build } : container.build;
    const dockerfile = build.dockerfile ?? 'Dockerfile';
    const context = normalizeProjectPath(build.context ?? '.');
    const dockerfilePath =
      context === undefined || posix.isAbsolute(dockerfile)
        ? undefined
        : normalizeProjectPath(posix.join(context, dockerfile));

    if (context === undefined || dockerfilePath === undefined) {
      return yield* new ContainerConfigError({
        message: `Container '${name}' has a build context or Dockerfile outside the project.`,
        containerName: name,
      });
    }

    const projectRoot = yield* resolveProjectRoot(projectFolder);
    yield* resolveInsideProject(projectRoot, context, `The build context '${context}' of container '${name}'`, {
      containerName: name,
    });
    const dockerfileReal = yield* resolveInsideProject(
      projectRoot,
      dockerfilePath,
      `The Dockerfile '${dockerfilePath}' of container '${name}'`,
      { containerName: name }
    );
    if (Option.isNone(dockerfileReal)) {
      return yield* new ContainerConfigError({
        message: `Container '${name}' builds '${dockerfilePath}', which does not exist.`,
        containerName: name,
      });
    }

    source = {
      type: 'dockerfile',
      context,
      dockerfile: posix.relative(context, dockerfilePath),
      ...(build.target !== undefined && { target: build.target }),
      ...(build.args !== undefined && Object.keys(build.args).length > 0 && { buildArgs: { ...build.args } }),
    };
  } else {
    return yield* new ContainerConfigError({
      message: `Container '${name}' must set exactly one of 'image' and 'build'.`,
      containerName: name,
    });
  }

  const entrypoint = yield* toArgv(name, 'entrypoint', container.entrypoint);
  const command = yield* toArgv(name, 'command', container.command);

  const spec: NormalizedContainerSpec = {
    name,
    source,
    ...(container.port !== undefined && { port: container.port }),
    ...(entrypoint !== undefined && { entrypoint }),
    ...(command !== undefined && { command }),
    ...(container.working_dir !== undefined && { workingDirectory: container.working_dir }),
    ...(container.user !== undefined && { user: String(container.user) }),
    ...(container.env !== undefined &&
      Object.keys(container.env).length > 0 && { environmentVariables: { ...container.env } }),
  };
  return spec;
});

/**
 * Turns the `containers` map into container-function entrypoints and sidecars.
 *
 * Validates names, the bounds the v4 schema sets (so Compose-imported entries
 * fail as early as written ones), the sidecar count, and explicitly declared
 * ports that would collide inside one microVM. Ports an image only exposes are
 * checked later, once the image config is known.
 *
 * @param containers - The `containers` map, after any Compose import
 * @param projectFolder - Absolute path to the project root
 */
export const normalizeContainers = Effect.fn('normalizeContainers')(function* (
  containers: Readonly<Record<string, ConfigV4Container>>,
  projectFolder: string
) {
  const entrypoints: NormalizedConfigEntrypoint[] = [];
  const sidecars: NormalizedSidecar[] = [];
  const warnings: string[] = [];

  for (const [name, container] of Object.entries(containers)) {
    if (!CONTAINER_NAME_PATTERN.test(name) || name === 'localhost') {
      return yield* new ContainerConfigError({
        message: `Container name '${name}' is invalid. The name is also the hostname the function reaches the container by, so it must be ${CONTAINER_NAME_RULES}. Try '${toContainerName(name)}'.`,
        containerName: name,
      });
    }

    const spec = yield* toContainerSpec(name, container, projectFolder);

    if (container.sidecar === true) {
      const ignored = (['max_duration', 'streaming', 'schedule'] as const).filter(
        (key) => container[key] !== undefined
      );
      if (ignored.length > 0) {
        warnings.push(
          `Sidecar '${name}' ignores ${ignored.join(', ')}: those settings apply to container functions only.`
        );
      }
      sidecars.push({ ...spec, memory: container.memory ?? DEFAULT_SIDECAR_MEMORY_MB });
      continue;
    }

    entrypoints.push({
      path: containerEntrypointPath(name),
      displayName: name,
      runtime: CONTAINER_RUNTIME,
      memory: container.memory ?? DEFAULT_CONTAINER_MEMORY_MB,
      maxDuration: container.max_duration ?? DEFAULT_FUNCTION_DURATION_SECONDS,
      streaming: container.streaming ?? true,
      ...(container.schedule !== undefined && { schedule: container.schedule }),
      container: spec,
    });
  }

  if (sidecars.length > MAX_SIDECARS) {
    return yield* new ContainerConfigError({
      message: `A deployment may declare at most ${MAX_SIDECARS} sidecars; this one declares ${sidecars.length}.`,
    });
  }

  const sidecarPorts = new Map<number, string>();
  for (const sidecar of sidecars) {
    if (sidecar.port === undefined) continue;
    const owner = sidecarPorts.get(sidecar.port);
    if (owner !== undefined) {
      return yield* new ContainerConfigError({
        message: `Sidecars '${owner}' and '${sidecar.name}' both listen on port ${sidecar.port}. Sidecars share one network namespace, so their ports must differ.`,
        containerName: sidecar.name,
      });
    }
    sidecarPorts.set(sidecar.port, sidecar.name);
  }

  for (const entrypoint of entrypoints) {
    const port = entrypoint.container?.port;
    const sidecar = port === undefined ? undefined : sidecarPorts.get(port);
    if (sidecar !== undefined) {
      return yield* new ContainerConfigError({
        message: `Container '${entrypoint.displayName}' and sidecar '${sidecar}' both listen on port ${port}. Sidecars run inside the function's microVM, so their ports must differ.`,
        containerName: sidecar,
      });
    }
  }

  return { entrypoints, sidecars, warnings };
});

// -- Compose import -----------------------------------------------------------------------------

type ComposeRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is ComposeRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

/** Compose writes scalar values unquoted, so `PORT: 8080` and `DEBUG: true` arrive as numbers and booleans. */
const scalarToString = (value: unknown): string | undefined =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : undefined;

/** The `x-gigadrive` extension of a Compose service: `public`, `sidecar` and `skip` markers. */
const gigadriveExtension = (service: ComposeRecord): ComposeRecord =>
  isRecord(service['x-gigadrive']) ? service['x-gigadrive'] : {};

/** Override files `docker compose` merges over a Compose file it found under a default name. */
const COMPOSE_OVERRIDE_FILE_NAMES = [
  'compose.override.yaml',
  'compose.override.yml',
  'docker-compose.override.yaml',
  'docker-compose.override.yml',
] as const;

/** Index of the quote that closes a value opened by `quote`, skipping backslash escapes inside double quotes. */
const findClosingQuote = (body: string, quote: string): number => {
  for (let index = 0; index < body.length; index += 1) {
    if (quote === '"' && body[index] === '\\') index += 1;
    else if (body[index] === quote) return index;
  }
  return -1;
};

const DOUBLE_QUOTE_ESCAPES: Readonly<Record<string, string>> = { n: '\n', r: '\r', t: '\t' };

/**
 * Reads `KEY=VALUE` lines the way Compose reads `.env` and `env_file`: an
 * optional `export`, quoted values that may span lines and be followed by a
 * comment, escapes inside double quotes, and ` #` comments after unquoted values.
 */
const parseDotEnv = (content: string): Record<string, string> => {
  const values: Record<string, string> = {};
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=(.*)$/.exec(lines[index]);
    if (!match) continue;
    const [, key, rest] = match;
    const quote = rest.trimStart()[0];
    if (quote === '"' || quote === "'") {
      let body = rest.trimStart().slice(1);
      let end = index;
      let close = findClosingQuote(body, quote);
      while (close === -1 && end + 1 < lines.length) {
        end += 1;
        body += `\n${lines[end]}`;
        close = findClosingQuote(body, quote);
      }
      if (close !== -1) {
        const raw = body.slice(0, close);
        values[key] =
          quote === '"'
            ? raw.replace(/\\([nrt"\\])/g, (_match, char: string) => DOUBLE_QUOTE_ESCAPES[char] ?? char)
            : raw;
        index = end;
        continue;
      }
    }
    values[key] = rest.replace(/\s+#.*$/, '').trim();
  }
  return values;
};

/** A Compose interpolation that cannot be resolved. The message completes "Compose service 'x' …". */
class InterpolationError extends Error {}

/** Index of the `}` closing a `${` whose body starts at `start`, skipping nested `${…}` and `$$`. */
const findClosingBrace = (value: string, start: number): number => {
  let depth = 0;
  for (let index = start; index < value.length; index += 1) {
    if (value[index] === '$' && (value[index + 1] === '$' || value[index + 1] === '{')) {
      if (value[index + 1] === '{') depth += 1;
      index += 1;
    } else if (value[index] === '}') {
      if (depth === 0) return index;
      depth -= 1;
    }
  }
  return -1;
};

/**
 * Applies Compose variable interpolation: `$$`, `$VAR`, `${VAR}`, and the
 * `${VAR:-default}`, `${VAR-default}`, `${VAR:?error}`, `${VAR?error}`,
 * `${VAR:+replacement}` and `${VAR+replacement}` forms, whose operands may
 * nest further substitutions. The `:` forms treat an empty value as unset. An
 * unset variable without a default becomes an empty string, as in Compose, and
 * is reported once. A `$` before anything else stays as written.
 *
 * @param where - Location of the value in the service, for error messages
 * @throws InterpolationError for an unset required variable, as `docker compose` aborts, or a malformed `${`
 */
const interpolate = (
  value: string,
  variables: Readonly<Record<string, string>>,
  missing: Set<string>,
  where: string
): string => {
  let result = '';
  let index = 0;
  while (index < value.length) {
    const dollar = value.indexOf('$', index);
    if (dollar === -1) {
      result += value.slice(index);
      break;
    }
    result += value.slice(index, dollar);
    const next = value[dollar + 1];

    if (next === '$') {
      result += '$';
      index = dollar + 2;
      continue;
    }

    if (next === '{') {
      const close = findClosingBrace(value, dollar + 2);
      const expression =
        close === -1 ? null : /^([A-Za-z_][A-Za-z0-9_]*)(?:(:?[-?+])([\s\S]*))?$/.exec(value.slice(dollar + 2, close));
      if (expression === null) {
        throw new InterpolationError(`has an invalid variable reference in ${where}. Write '$$' for a literal '$'.`);
      }
      const [, name, operator, operand = ''] = expression;
      const current = variables[name];
      const isSet = current !== undefined && !(operator?.startsWith(':') === true && current === '');
      if (operator === undefined) {
        if (current === undefined) missing.add(name);
        result += current ?? '';
      } else if (operator.endsWith('-')) {
        result += isSet ? current : interpolate(operand, variables, missing, where);
      } else if (operator.endsWith('+')) {
        result += isSet ? interpolate(operand, variables, missing, where) : '';
      } else if (isSet) {
        result += current;
      } else {
        const reason = interpolate(operand, variables, missing, where);
        throw new InterpolationError(
          `needs variable '${name}' in ${where}, which is ${current === undefined ? 'not set' : 'empty'}${reason === '' ? '' : `: ${reason}`}. Compose variables come only from the .env file next to the Compose file.`
        );
      }
      index = close + 1;
      continue;
    }

    const bare = /^[A-Za-z_][A-Za-z0-9_]*/.exec(value.slice(dollar + 1))?.[0];
    if (bare === undefined) {
      result += '$';
      index = dollar + 1;
      continue;
    }
    if (variables[bare] === undefined) missing.add(bare);
    result += variables[bare] ?? '';
    index = dollar + 1 + bare.length;
  }
  return result;
};

/** Recursively interpolates every string inside a parsed Compose service; `where` tracks the key path. */
const interpolateDeep = (
  value: unknown,
  variables: Readonly<Record<string, string>>,
  missing: Set<string>,
  where: string
): unknown => {
  if (typeof value === 'string') return interpolate(value, variables, missing, where);
  if (Array.isArray(value)) {
    return value.map((item, index) => interpolateDeep(item, variables, missing, `${where}[${index}]`));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        interpolateDeep(item, variables, missing, where === '' ? key : `${where}.${key}`),
      ])
    );
  }
  return value;
};

/**
 * Converts a Compose memory size to MB, rounding up. Units are binary however
 * they are spelled, as Docker reads them: `512m`, `512MiB`, `512 MB`, `1.5g`,
 * `1GiB`, or a plain byte count.
 *
 * @returns MB, or `undefined` when Docker would not accept the value
 */
const parseComposeMemory = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? Math.ceil(value / 1024 ** 2) : undefined;
  }
  if (typeof value !== 'string') return undefined;
  const match = /^(\d+(?:\.\d+)?) ?([kmgtp])?i?b?$/i.exec(value.trim());
  if (!match) return undefined;
  const exponent = ' kmgtp'.indexOf((match[2] ?? ' ').toLowerCase());
  return Math.ceil((Number(match[1]) * 1024 ** exponent) / 1024 ** 2);
};

/**
 * Container-side TCP port of a Compose `ports` or `expose` entry: `3000`,
 * `"8080:80"`, `"127.0.0.1:8080:80/tcp"`, or the long syntax
 * `{ target: 80, published: "8080" }`, whose values may be strings after
 * interpolation. UDP entries yield no port.
 */
const parseComposePort = (entry: unknown): number | undefined => {
  let port: unknown = entry;
  if (isRecord(entry)) {
    if (typeof entry.protocol === 'string' && entry.protocol.toLowerCase() !== 'tcp') return undefined;
    port = entry.target;
  } else if (typeof entry === 'string') {
    const [withoutProtocol, protocol] = entry.split('/');
    if (protocol !== undefined && protocol.toLowerCase() !== 'tcp') return undefined;
    port = (withoutProtocol.split(':').at(-1) ?? '').split('-')[0];
  }
  const number = typeof port === 'number' ? port : typeof port === 'string' && /^\d+$/.test(port) ? Number(port) : NaN;
  return isIntegerBetween(number, 1, 65_535) ? number : undefined;
};

const parseComposeEnvironment = (
  serviceName: string,
  value: unknown,
  warnings: string[]
): Record<string, string> | undefined => {
  if (value === undefined || value === null) return undefined;
  const environment: Record<string, string> = {};
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item !== 'string') continue;
      const separator = item.indexOf('=');
      if (separator === -1) {
        warnings.push(
          `Compose service '${serviceName}' takes '${item}' from the host environment, which deployments do not have. Set it in the console instead.`
        );
        continue;
      }
      environment[item.slice(0, separator)] = item.slice(separator + 1);
    }
  } else if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      const scalar = scalarToString(item);
      if (scalar === undefined) {
        warnings.push(
          `Compose service '${serviceName}' takes '${key}' from the host environment, which deployments do not have. Set it in the console instead.`
        );
        continue;
      }
      environment[key] = scalar;
    }
  }
  return environment;
};

const isPublicMarked = (service: ComposeRecord) => gigadriveExtension(service).public === true;

const buildsFromSource = (service: ComposeRecord) =>
  service.build !== undefined && gigadriveExtension(service).sidecar !== true;

/**
 * Reads and parses a Compose file, and returns the services `docker compose up`
 * would start: those outside any profile and not marked
 * `x-gigadrive: { skip: true }`. Values are not interpolated yet. The file must
 * resolve inside the project, and parse errors never echo its contents.
 */
const loadComposeServices = Effect.fn('loadComposeServices')(function* (composePath: string, projectFolder: string) {
  const relativePath = normalizeProjectPath(composePath);
  if (relativePath === undefined) {
    return yield* new ContainerConfigError({
      message: `Compose file '${composePath}' is outside the project.`,
      filePath: composePath,
    });
  }

  const projectRoot = yield* resolveProjectRoot(projectFolder);
  const content = yield* readInsideProject(projectRoot, relativePath, `Compose file '${relativePath}'`, {
    filePath: relativePath,
  });
  if (Option.isNone(content)) {
    return yield* new ContainerConfigError({
      message: `Compose file '${relativePath}' could not be read.`,
      filePath: relativePath,
    });
  }

  const document = yield* Effect.try({
    try: () => parseYaml(content.value) as unknown,
    catch: (error) => {
      const position = error instanceof YAMLError ? error.linePos?.[0] : undefined;
      return new ContainerConfigError({
        message: `Compose file '${relativePath}' is not valid YAML${position ? ` (line ${position.line}, column ${position.col})` : ''}.`,
        filePath: relativePath,
      });
    },
  });

  if (!isRecord(document) || !isRecord(document.services) || Object.keys(document.services).length === 0) {
    return yield* new ContainerConfigError({
      message: `Compose file '${relativePath}' declares no services.`,
      filePath: relativePath,
    });
  }

  const services = Object.entries(document.services).filter(
    (entry): entry is [string, ComposeRecord] =>
      isRecord(entry[1]) &&
      !(isStringArray(entry[1].profiles) && entry[1].profiles.length > 0) &&
      gigadriveExtension(entry[1]).skip !== true
  );
  return { relativePath, projectRoot, services };
});

/**
 * Tells whether a Compose file names an application to deploy: a service
 * marked `x-gigadrive: { public: true }`, or one that builds from source.
 * Auto-detection skips a Compose file without one, such as one that only runs
 * a database for local development.
 *
 * @param composePath - Project-relative path of the Compose file
 * @param projectFolder - Absolute path to the project root
 */
export const composeDeclaresApp = Effect.fn('composeDeclaresApp')(function* (
  composePath: string,
  projectFolder: string
) {
  const { services } = yield* loadComposeServices(composePath, projectFolder);
  return services.some(([, service]) => isPublicMarked(service) || buildsFromSource(service));
});

/**
 * Reads a Compose file and maps its services onto `containers` entries.
 *
 * The container function is the service marked `x-gigadrive: { public: true }`,
 * or else the only service that builds from source; anything else is
 * ambiguous and fails. Every other service becomes a sidecar that the function
 * reaches by its service name, the way Compose's default network resolves it.
 * Services behind a profile are skipped, as `docker compose up` skips them.
 * Volumes, networks, health checks and restart policies have no equivalent and
 * are dropped; volumes, `extends` and override files are reported.
 *
 * Every file read (the Compose file, `.env`, `env_file`) must resolve inside
 * the project after following symbolic links.
 *
 * @param composePath - Project-relative path of the Compose file
 * @param projectFolder - Absolute path to the project root
 */
export const readComposeContainers = Effect.fn('readComposeContainers')(function* (
  composePath: string,
  projectFolder: string
) {
  const fs = yield* FileSystem.FileSystem;
  const pathSvc = yield* Path.Path;

  const { relativePath, projectRoot, services } = yield* loadComposeServices(composePath, projectFolder);
  const composeDirectory = posix.dirname(relativePath);
  const warnings: string[] = [];

  for (const [name] of services) {
    if (!CONTAINER_NAME_PATTERN.test(name) || name === 'localhost') {
      return yield* new ContainerConfigError({
        message: `Compose service '${name}' cannot be imported under that name. The service name becomes the hostname the function reaches it by, so it must be ${CONTAINER_NAME_RULES}. Rename the service to '${toContainerName(name)}' in '${relativePath}'.`,
        containerName: name,
        filePath: relativePath,
      });
    }
  }

  const marked = services.filter(([, service]) => isPublicMarked(service)).map(([name]) => name);
  const built = services.filter(([, service]) => buildsFromSource(service)).map(([name]) => name);
  if (marked.length > 1) {
    return yield* new ContainerConfigError({
      message: `Compose file '${relativePath}' marks ${marked.map((name) => `'${name}'`).join(', ')} as public. One service serves HTTP: keep 'x-gigadrive: { public: true }' on that one only.`,
      filePath: relativePath,
    });
  }
  const publicService = marked[0] ?? (built.length === 1 ? built[0] : undefined);
  if (publicService === undefined) {
    return yield* new ContainerConfigError({
      message:
        built.length === 0
          ? `Compose file '${relativePath}' has no service that builds from source, so it is unclear which service serves HTTP. Mark it with 'x-gigadrive: { public: true }'.`
          : `Compose file '${relativePath}' builds ${built.map((name) => `'${name}'`).join(', ')} from source, so it is unclear which service serves HTTP. Mark it with 'x-gigadrive: { public: true }'.`,
      filePath: relativePath,
    });
  }

  if ((COMPOSE_FILE_NAMES as readonly string[]).includes(posix.basename(relativePath))) {
    for (const overrideName of COMPOSE_OVERRIDE_FILE_NAMES) {
      const overridePath = posix.join(composeDirectory, overrideName);
      const overrideExists = yield* fs
        .exists(pathSvc.join(projectRoot, overridePath))
        .pipe(Effect.orElseSucceed(() => false));
      if (overrideExists) {
        warnings.push(
          `Compose file '${relativePath}' has the override file '${overridePath}' next to it, which is not merged. Move its settings into '${relativePath}' or gigadrive.yaml.`
        );
      }
    }
  }

  const dotEnv = yield* readInsideProject(
    projectRoot,
    posix.join(composeDirectory, '.env'),
    `The .env file next to '${relativePath}'`,
    { filePath: relativePath }
  );
  const variables = Option.isSome(dotEnv) ? parseDotEnv(dotEnv.value) : {};
  const missing = new Set<string>();

  const containers: Record<string, ConfigV4Container> = {};
  for (const [name, rawService] of services) {
    const isPublic = name === publicService;
    const service = yield* Effect.try({
      try: () => interpolateDeep(rawService, variables, missing, '') as ComposeRecord,
      catch: (error) =>
        new ContainerConfigError({
          message: `Compose service '${name}' ${error instanceof InterpolationError ? error.message : 'could not be interpolated.'}`,
          containerName: name,
          filePath: relativePath,
        }),
    });
    const container: ConfigV4Container = {};

    if (service.extends !== undefined) {
      warnings.push(
        `Compose service '${name}' uses 'extends', which is not supported. The service is deployed as written, without the settings it would inherit.`
      );
    }

    if (typeof service.image === 'string' && service.build === undefined) {
      container.image = service.image;
    } else if (typeof service.build === 'string' || isRecord(service.build)) {
      const build = typeof service.build === 'string' ? { context: service.build } : service.build;
      if (build.dockerfile_inline !== undefined) {
        return yield* new ContainerConfigError({
          message: `Compose service '${name}' uses build.dockerfile_inline, which is not supported. Commit the Dockerfile and point build.dockerfile at it.`,
          containerName: name,
          filePath: relativePath,
        });
      }
      const rawContext = typeof build.context === 'string' ? build.context : '.';
      // An absolute context stays absolute, so normalizeContainers refuses it as outside the project.
      const context = posix.isAbsolute(rawContext) ? rawContext : posix.join(composeDirectory, rawContext);
      const args = Array.isArray(build.args)
        ? Object.fromEntries(
            build.args
              .filter((item): item is string => typeof item === 'string' && item.includes('='))
              .map((item) => [item.slice(0, item.indexOf('=')), item.slice(item.indexOf('=') + 1)])
          )
        : isRecord(build.args)
          ? Object.fromEntries(Object.entries(build.args).map(([key, item]) => [key, scalarToString(item) ?? '']))
          : undefined;
      container.build = {
        context,
        ...(typeof build.dockerfile === 'string' && { dockerfile: build.dockerfile }),
        ...(typeof build.target === 'string' && { target: build.target }),
        ...(args !== undefined && Object.keys(args).length > 0 && { args }),
      };
    } else {
      return yield* new ContainerConfigError({
        message: `Compose service '${name}' has neither an image nor a build.`,
        containerName: name,
        filePath: relativePath,
      });
    }

    if (!isPublic) container.sidecar = true;

    const ports = [
      ...(isPublic && Array.isArray(service.ports) ? service.ports : []),
      ...(Array.isArray(service.expose) ? service.expose : []),
      ...(!isPublic && Array.isArray(service.ports) ? service.ports : []),
    ];
    const port = ports.map(parseComposePort).find((value) => value !== undefined);
    if (port !== undefined) container.port = port;

    for (const key of ['entrypoint', 'command'] as const) {
      const value = service[key];
      if (typeof value === 'string' || isStringArray(value)) container[key] = value;
    }

    const environment: Record<string, string> = {};
    const envFiles = (
      typeof service.env_file === 'string'
        ? [service.env_file]
        : Array.isArray(service.env_file)
          ? service.env_file
          : []
    ).flatMap((entry: unknown): Array<{ path: string; required?: boolean }> =>
      typeof entry === 'string'
        ? [{ path: entry }]
        : isRecord(entry) && typeof entry.path === 'string'
          ? [{ path: entry.path, ...(typeof entry.required === 'boolean' && { required: entry.required }) }]
          : []
    );
    for (const envFile of envFiles) {
      const envFilePath = posix.isAbsolute(envFile.path)
        ? undefined
        : normalizeProjectPath(posix.join(composeDirectory, envFile.path));
      const envContent =
        envFilePath === undefined
          ? Option.none<string>()
          : yield* readInsideProject(
              projectRoot,
              envFilePath,
              `The env_file '${envFile.path}' of Compose service '${name}'`,
              { containerName: name, filePath: relativePath }
            );
      if (Option.isSome(envContent)) {
        Object.assign(environment, parseDotEnv(envContent.value));
      } else if (envFile.required === true) {
        return yield* new ContainerConfigError({
          message: `Compose service '${name}' requires env_file '${envFile.path}', which is not in the deployed source. Commit it, mark it 'required: false', or set those variables in the console.`,
          containerName: name,
          filePath: relativePath,
        });
      } else if (envFile.required === undefined) {
        warnings.push(
          `Compose service '${name}' reads env_file '${envFile.path}', which is not in the deployed source. Set those variables in the console instead.`
        );
      }
    }
    Object.assign(environment, parseComposeEnvironment(name, service.environment, warnings));
    if (Object.keys(environment).length > 0) container.env = environment;

    if (typeof service.working_dir === 'string') container.working_dir = service.working_dir;
    if (typeof service.user === 'string' || typeof service.user === 'number') container.user = String(service.user);

    const deploy = isRecord(service.deploy) ? service.deploy : {};
    const resources = isRecord(deploy.resources) ? deploy.resources : {};
    const limits = isRecord(resources.limits) ? resources.limits : {};
    const memoryLimit = limits.memory ?? service.mem_limit;
    if (memoryLimit !== undefined && memoryLimit !== null) {
      const memory = parseComposeMemory(memoryLimit);
      if (memory === undefined) {
        warnings.push(
          `Compose service '${name}' sets the memory limit ${JSON.stringify(memoryLimit)}, which is not a size Docker accepts. The default is used instead.`
        );
      } else if (memory >= MIN_CONTAINER_MEMORY_MB && memory <= MAX_CONTAINER_MEMORY_MB) {
        container.memory = memory;
        // Docker reads 0 as no limit, which leaves the default in place without a warning.
      } else if (memory > 0) {
        warnings.push(
          `Compose service '${name}' asks for ${memory} MB of memory, outside the supported ${MIN_CONTAINER_MEMORY_MB} to ${MAX_CONTAINER_MEMORY_MB} MB. The default is used instead.`
        );
      }
    }

    if (service.volumes !== undefined) {
      warnings.push(
        `Compose service '${name}' declares volumes. Containers on Gigadrive Network have no persistent volumes, so anything written there is lost when the instance stops.`
      );
    }

    containers[name] = container;
  }

  if (missing.size > 0) {
    warnings.push(
      `Compose file '${relativePath}' uses ${[...missing].sort().join(', ')}, which ${missing.size === 1 ? 'is' : 'are'} not set. ${missing.size === 1 ? 'It was' : 'They were'} replaced with an empty string.`
    );
  }

  return { containers, publicService, warnings };
});

import { FileSystem, Path } from '@effect/platform';
import { Effect } from 'effect';
import { posix } from 'node:path';
import { parse as parseYaml } from 'yaml';
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

/** Valid container name, which is also the hostname a sidecar answers to. Mirrors the v4 schema. */
const CONTAINER_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,62}$/;

/** Memory bounds of a container, in MB. Mirrors the v4 schema. */
const MIN_CONTAINER_MEMORY_MB = 128;
const MAX_CONTAINER_MEMORY_MB = 3009;

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

  if (quote) throw new Error(`Unterminated ${quote} quote in "${input}"`);
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

/**
 * Resolves one `containers` entry into the image spec the deployment builds.
 * A Dockerfile must exist inside the project.
 */
const toContainerSpec = Effect.fn('toContainerSpec')(function* (
  name: string,
  container: ConfigV4Container,
  projectFolder: string
) {
  const fs = yield* FileSystem.FileSystem;
  const pathSvc = yield* Path.Path;

  let source: NormalizedContainerImageSource;
  if (container.image !== undefined && container.build === undefined) {
    source = { type: 'registry', reference: container.image };
  } else if (container.build !== undefined && container.image === undefined) {
    const build: ConfigV4ContainerBuild =
      typeof container.build === 'string' ? { context: container.build } : container.build;
    const context = normalizeProjectPath(build.context ?? '.');
    const dockerfilePath = context && normalizeProjectPath(posix.join(context, build.dockerfile ?? 'Dockerfile'));

    if (context === undefined || dockerfilePath === undefined) {
      return yield* new ContainerConfigError({
        message: `Container '${name}' has a build context or Dockerfile outside the project.`,
        containerName: name,
      });
    }

    const dockerfileExists = yield* fs
      .exists(pathSvc.join(projectFolder, dockerfilePath))
      .pipe(Effect.catchAll(() => Effect.succeed(false)));
    if (!dockerfileExists) {
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
    ...(container.user !== undefined && { user: container.user }),
    ...(container.env !== undefined &&
      Object.keys(container.env).length > 0 && { environmentVariables: { ...container.env } }),
  };
  return spec;
});

/**
 * Turns the `containers` map into container-function entrypoints and sidecars.
 *
 * Validates names, the sidecar count, and explicitly declared ports that would
 * collide inside one microVM. Ports an image only exposes are checked later,
 * once the image config is known.
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
        message: `Container name '${name}' is invalid. Use 1 to 63 lowercase letters, digits, '-' or '_', starting with a letter or digit.`,
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

/** Reads `KEY=VALUE` lines the way Compose reads `.env` and `env_file`. */
const parseDotEnv = (content: string): Record<string, string> => {
  const values: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2];
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.length >= 2 && value.endsWith(quote)) {
      value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    } else {
      value = value.replace(/\s+#.*$/, '');
    }
    values[match[1]] = value;
  }
  return values;
};

/**
 * Applies Compose variable interpolation: `$$`, `$VAR`, `${VAR}`, `${VAR:-default}`,
 * `${VAR-default}`, `${VAR:?err}` and `${VAR?err}`. An unset variable without a
 * default becomes an empty string, as in Compose, and is reported once.
 */
const interpolate = (value: string, variables: Readonly<Record<string, string>>, missing: Set<string>): string =>
  value.replace(
    /\$(?:(\$)|\{([A-Za-z_][A-Za-z0-9_]*)(?:(:?[-?])([^}]*))?\}|([A-Za-z_][A-Za-z0-9_]*))/g,
    (
      _match,
      escaped: string | undefined,
      braced: string | undefined,
      operator: string | undefined,
      operand: string | undefined,
      bare: string | undefined
    ) => {
      if (escaped) return '$';
      const name = (braced ?? bare)!;
      const current = variables[name];
      const unset = current === undefined || (operator?.startsWith(':') === true && current === '');
      if (!unset) return current;
      if (operator === '-' || operator === ':-') return operand ?? '';
      missing.add(name);
      return '';
    }
  );

/** Recursively interpolates every string inside a parsed Compose document. */
const interpolateDeep = (
  value: unknown,
  variables: Readonly<Record<string, string>>,
  missing: Set<string>
): unknown => {
  if (typeof value === 'string') return interpolate(value, variables, missing);
  if (Array.isArray(value)) return value.map((item) => interpolateDeep(item, variables, missing));
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, interpolateDeep(item, variables, missing)])
    );
  }
  return value;
};

/** Converts a Compose byte size (`512m`, `1g`, `1073741824`) to MB, rounding up. */
const parseComposeMemory = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Math.ceil(value / (1024 * 1024));
  if (typeof value !== 'string') return undefined;
  const match = /^(\d+(?:\.\d+)?)\s*([bkmg]?)b?$/i.exec(value.trim());
  if (!match) return undefined;
  const scale = { '': 1, b: 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3 }[
    match[2].toLowerCase() as '' | 'b' | 'k' | 'm' | 'g'
  ];
  return Math.ceil((Number(match[1]) * scale) / (1024 * 1024));
};

/** Container-side port of a Compose `ports` or `expose` entry: `3000`, `"8080:80"`, `"127.0.0.1:8080:80/tcp"`, `{ target: 80 }`. */
const parseComposePort = (entry: unknown): number | undefined => {
  if (typeof entry === 'number') return entry;
  if (isRecord(entry)) return typeof entry.target === 'number' ? entry.target : undefined;
  if (typeof entry !== 'string') return undefined;
  const [withoutProtocol, protocol] = entry.split('/');
  if (protocol !== undefined && protocol.toLowerCase() !== 'tcp') return undefined;
  const containerPart = withoutProtocol.split(':').at(-1) ?? '';
  const port = Number(containerPart.split('-')[0]);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : undefined;
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

/**
 * Picks the service that serves HTTP: an explicit `x-gigadrive.public: true`,
 * else the first service that builds from source, else the first service that
 * publishes a port.
 */
const pickPublicService = (services: ReadonlyArray<[string, ComposeRecord]>): string | undefined => {
  const extension = (service: ComposeRecord) => (isRecord(service['x-gigadrive']) ? service['x-gigadrive'] : {});
  return (
    services.find(([, service]) => extension(service).public === true)?.[0] ??
    services.find(([, service]) => extension(service).sidecar !== true && service.build !== undefined)?.[0] ??
    services.find(
      ([, service]) => extension(service).sidecar !== true && Array.isArray(service.ports) && service.ports.length > 0
    )?.[0]
  );
};

/**
 * Reads a Compose file and maps its services onto `containers` entries.
 *
 * One service becomes the container function (see {@link pickPublicService});
 * every other service becomes a sidecar that the function reaches by its
 * service name, the way Compose's default network resolves it. Services behind
 * a profile are skipped, as `docker compose up` skips them. Volumes, networks,
 * health checks and restart policies have no equivalent and are dropped, and
 * volumes are reported because their data does not persist.
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

  const relativePath = normalizeProjectPath(composePath);
  if (relativePath === undefined) {
    return yield* new ContainerConfigError({
      message: `Compose file '${composePath}' is outside the project.`,
      filePath: composePath,
    });
  }

  const absolutePath = pathSvc.join(projectFolder, relativePath);
  const content = yield* fs.readFileString(absolutePath).pipe(
    Effect.mapError(
      () =>
        new ContainerConfigError({
          message: `Compose file '${relativePath}' could not be read.`,
          filePath: relativePath,
        })
    )
  );

  const document = yield* Effect.try({
    try: () => parseYaml(content) as unknown,
    catch: (error) =>
      new ContainerConfigError({
        message: `Compose file '${relativePath}' is not valid YAML: ${error instanceof Error ? error.message : String(error)}`,
        filePath: relativePath,
      }),
  });

  if (!isRecord(document) || !isRecord(document.services) || Object.keys(document.services).length === 0) {
    return yield* new ContainerConfigError({
      message: `Compose file '${relativePath}' declares no services.`,
      filePath: relativePath,
    });
  }

  const composeDirectory = posix.dirname(relativePath);
  const readOptionalFile = (projectRelative: string) =>
    fs.readFileString(pathSvc.join(projectFolder, projectRelative)).pipe(Effect.option);

  const dotEnv = yield* readOptionalFile(posix.join(composeDirectory, '.env'));
  const variables = dotEnv._tag === 'Some' ? parseDotEnv(dotEnv.value) : {};
  const missing = new Set<string>();
  const warnings: string[] = [];

  const services: Array<[string, ComposeRecord]> = [];
  for (const [name, rawService] of Object.entries(document.services)) {
    if (!isRecord(rawService)) continue;
    const service = interpolateDeep(rawService, variables, missing) as ComposeRecord;
    if (isStringArray(service.profiles) && service.profiles.length > 0) continue;
    if (isRecord(service['x-gigadrive']) && service['x-gigadrive'].skip === true) continue;
    services.push([name, service]);
  }

  const publicService = pickPublicService(services);
  if (publicService === undefined) {
    return yield* new ContainerConfigError({
      message: `Compose file '${relativePath}' has no service that builds from source or publishes a port. Mark the service that serves HTTP with 'x-gigadrive: { public: true }'.`,
      filePath: relativePath,
    });
  }

  const containers: Record<string, ConfigV4Container> = {};
  for (const [name, service] of services) {
    const isPublic = name === publicService;
    const container: ConfigV4Container = {};

    if (typeof service.image === 'string' && service.build === undefined) {
      container.image = service.image;
    } else if (typeof service.build === 'string' || isRecord(service.build)) {
      const build = typeof service.build === 'string' ? { context: service.build } : service.build;
      const context = posix.join(composeDirectory, typeof build.context === 'string' ? build.context : '.');
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
    const envFiles =
      typeof service.env_file === 'string'
        ? [service.env_file]
        : isStringArray(service.env_file)
          ? service.env_file
          : [];
    for (const envFile of envFiles) {
      const envFilePath = normalizeProjectPath(posix.join(composeDirectory, envFile));
      const envContent = envFilePath === undefined ? undefined : yield* readOptionalFile(envFilePath);
      if (envContent?._tag === 'Some') {
        Object.assign(environment, parseDotEnv(envContent.value));
      } else {
        warnings.push(
          `Compose service '${name}' reads env_file '${envFile}', which is not in the deployed source. Set those variables in the console instead.`
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
    const memory = parseComposeMemory(limits.memory ?? service.mem_limit);
    if (memory !== undefined) {
      if (memory >= MIN_CONTAINER_MEMORY_MB && memory <= MAX_CONTAINER_MEMORY_MB) {
        container.memory = memory;
      } else {
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

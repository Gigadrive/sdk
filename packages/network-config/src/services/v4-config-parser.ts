import { getFilesForPattern } from '@gigadrive/build-utils';
import { Effect } from 'effect';
import { minimatch } from 'minimatch';
import { posix } from 'node:path';
import safeRegex from 'safe-regex2';
import { collectAssetFiles } from '../collect-asset-files';
import {
  containerEntrypointPath,
  dockerFunctionContainerName,
  normalizeContainers,
  readComposeContainers,
} from '../containers';
import { ContainerConfigError, FunctionConfigError } from '../errors';
import {
  CONTAINER_RUNTIME,
  DEFAULT_FUNCTION_DURATION_SECONDS,
  type NormalizedConfigEntrypoint,
  type NormalizedConfigQueue,
  type NormalizedConfigRoute,
  type NormalizedConfigRouteHandler,
  type NormalizedConfigServiceDefinition,
  type NormalizedImagePolicy,
} from '../normalized-config';
import { AVAILABLE_REGIONS, type Region } from '../regions';
import type {
  ConfigV4,
  ConfigV4Container,
  ConfigV4FunctionSettings,
  ConfigV4Queue,
  ConfigV4QueueDuration,
} from '../v4';

const DEFAULT_FUNCTION_SETTINGS: Required<Pick<ConfigV4FunctionSettings, 'memory' | 'max_duration'>> &
  Pick<ConfigV4FunctionSettings, 'schedule' | 'symlinks' | 'excludeFiles' | 'includeFiles'> = {
  memory: 128,
  max_duration: DEFAULT_FUNCTION_DURATION_SECONDS,
  schedule: undefined,
  symlinks: undefined,
  excludeFiles: undefined,
  includeFiles: undefined,
};

const toArray = (value: string | string[] | undefined): string[] | undefined => {
  if (value == null) return undefined;
  return Array.isArray(value) ? value : [value];
};

const runtimeStreamsByDefault = (runtime: ConfigV4FunctionSettings['runtime'] | undefined): boolean =>
  runtime == null || runtime.startsWith('node-') || runtime.startsWith('bun-');

const normalizeImagePolicy = (images: ConfigV4['images']): NormalizedImagePolicy | undefined => {
  if (!images) return undefined;
  return {
    localPatterns: images.localPatterns ?? [{ pathname: '/**' }],
    remotePatterns: images.remotePatterns ?? [],
    widths: images.widths ?? [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    heights: images.heights ?? [],
    qualities: images.qualities ?? [75],
    formats: images.formats ?? ['image/avif', 'image/webp'],
    minimumCacheTTL: images.minimumCacheTTL ?? 14_400,
    dangerouslyAllowSVG: images.dangerouslyAllowSVG ?? false,
    contentSecurityPolicy: images.contentSecurityPolicy ?? "default-src 'self'; script-src 'none'; sandbox;",
    contentDispositionType: images.contentDispositionType ?? 'attachment',
    maximumRedirects: images.maximumRedirects ?? 3,
    maximumResponseBody: images.maximumResponseBody ?? 50 * 1024 * 1024,
    variants: images.variants ?? {},
  };
};

const DURATION_UNIT_SECONDS = { s: 1, m: 60, h: 3_600, d: 86_400 } as const;

/** Resolves a queue duration (`90`, `'10m'`) to whole seconds; schema validation guarantees the shape. */
const queueDurationSeconds = (value: ConfigV4QueueDuration | undefined): number | undefined => {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value;
  const match = /^(\d+(?:\.\d+)?)(s|m|h|d)$/.exec(value);
  if (!match)
    throw new Error(`Invalid queue duration "${value}". Use seconds or a string such as 30s, 10m, 1.5h or 4d.`);
  return Math.ceil(Number(match[1]) * DURATION_UNIT_SECONDS[match[2] as keyof typeof DURATION_UNIT_SECONDS]);
};

const byName = <T extends { name: string }>(left: T, right: T) =>
  left.name < right.name ? -1 : left.name > right.name ? 1 : 0;

/** Drops keys whose value is `undefined`, so absent settings stay absent in the normalized config. */
const definedOnly = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;

const normalizeQueue = (name: string, queue: ConfigV4Queue | null): NormalizedConfigQueue => {
  if (queue === null) return { name };
  const schedules = queue.schedules
    ? Object.entries(queue.schedules)
        .map(([scheduleName, schedule]) =>
          definedOnly({
            name: scheduleName,
            cron: schedule.cron,
            timezone: schedule.timezone,
            body:
              schedule.body === undefined || typeof schedule.body === 'string'
                ? schedule.body
                : JSON.stringify(schedule.body),
            // A plain-text body labelled JSON would fail to decode on every fire.
            contentType:
              schedule.contentType ?? (typeof schedule.body === 'string' ? 'text/plain; charset=utf-8' : undefined),
            headers: schedule.headers,
            enabled: schedule.enabled,
          })
        )
        .sort(byName)
    : undefined;
  return definedOnly({
    name,
    consumer: queue.consumer,
    visibilityTimeoutSeconds: queueDurationSeconds(queue.visibilityTimeout),
    retentionSeconds: queueDurationSeconds(queue.retention),
    maxAttempts: queue.maxAttempts,
    retryBackoffMinSeconds: queueDurationSeconds(queue.retryBackoff?.min),
    retryBackoffMaxSeconds: queueDurationSeconds(queue.retryBackoff?.max),
    deduplicationWindowSeconds: queueDurationSeconds(queue.deduplicationWindow),
    concurrency: queue.concurrency,
    rateLimit:
      queue.rateLimit == null
        ? queue.rateLimit
        : { count: queue.rateLimit.count, periodSeconds: queueDurationSeconds(queue.rateLimit.period) ?? 1 },
    deadLetter: queue.deadLetter,
    schedules,
  });
};

/**
 * Converts keyed v4 service declarations into the stable normalized list used
 * by deployment provisioning.
 *
 * Storage bucket names are preserved exactly after schema validation and
 * sorted to keep deployment plans deterministic. Bucket visibility defaults
 * to private, matching the File Storage API creation contract. Queue
 * durations resolve to seconds and object schedule bodies to JSON.
 */
const normalizeServices = (services: ConfigV4['services']): NormalizedConfigServiceDefinition[] | undefined => {
  if (services == null) return undefined;

  const normalized: NormalizedConfigServiceDefinition[] = [];

  if (services.redis !== undefined) {
    normalized.push({ type: 'redis', ...(services.redis ?? {}) });
  }

  if (services.postgres !== undefined) {
    normalized.push({ type: 'postgres', ...(services.postgres ?? {}) });
  }

  if (services.storage !== undefined) {
    normalized.push({
      type: 'storage',
      buckets: Object.entries(services.storage.buckets)
        .map(([name, bucket]) => ({ name, visibility: bucket?.visibility ?? 'private' }))
        .sort(byName),
    });
  }

  if (services.queues !== undefined) {
    normalized.push({
      type: 'queues',
      queues: Object.entries(services.queues)
        .map(([name, queue]) => normalizeQueue(name, queue))
        .sort(byName),
    });
  }

  return normalized.length > 0 ? normalized : undefined;
};

const normalizeRouteDestination = (destination: string): string => {
  const [withoutHash] = destination.split('#', 1);
  const [withoutQuery] = withoutHash.split('?', 1);
  return withoutQuery.replace(/^\/+/, '');
};

const destinationMatchesEntrypoint = (destination: string, entrypointPath: string): boolean => {
  const normalizedDestination = normalizeRouteDestination(destination);
  if (normalizedDestination === entrypointPath) return true;
  if (!normalizedDestination.includes('$')) return false;

  const pattern = normalizedDestination.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\$[\w]+/g, '.+');
  return new RegExp(`^${pattern}$`).test(entrypointPath);
};

// -- Pure helpers (no Effect needed) ----------------------------------------------------------

/**
 * Tests whether a path matches a function pattern via glob or safe regex.
 */
const matchesPattern = (path: string, pattern: string): boolean => {
  if (minimatch(path, pattern)) return true;

  try {
    if (safeRegex(pattern)) {
      return new RegExp(pattern).test(path);
    }
  } catch {
    // pattern is not valid regex (e.g. glob like **), skip
  }

  return false;
};

/**
 * Resolves merged function settings for a given path by iterating all function
 * patterns in the config. Later patterns override earlier ones.
 *
 * @returns The merged settings, or undefined when no pattern matches the path.
 */
export const getFunctionSettings = (path: string, config: ConfigV4): ConfigV4FunctionSettings | undefined => {
  let settings: ConfigV4FunctionSettings | undefined;

  for (const [pattern, value] of Object.entries(config.functions ?? {})) {
    if (!matchesPattern(path, pattern)) continue;

    settings = { ...DEFAULT_FUNCTION_SETTINGS, ...settings, ...value };
  }

  return settings;
};

/**
 * Determines the route handler type based on destination and redirect flag.
 */
const resolveRouteHandler = (
  destination: string,
  redirect: boolean | undefined,
  entrypoints: readonly NormalizedConfigEntrypoint[] = []
): NormalizedConfigRouteHandler => {
  const isExternal =
    destination.toLowerCase().startsWith('http://') || destination.toLowerCase().startsWith('https://');

  if (redirect === true) return 'HTTP_REDIRECT';
  if (isExternal) return 'HTTP_PROXY';

  const matchingEntrypoints = entrypoints.filter((item) => destinationMatchesEntrypoint(destination, item.path));
  return matchingEntrypoints.length > 0 && matchingEntrypoints.every((entrypoint) => entrypoint.streaming === true)
    ? 'SERVERLESS_FUNCTION_STREAMING'
    : 'SERVERLESS_FUNCTION';
};

/** Type guard that validates a string is a known Region. */
const isRegion = (r: string): r is Region => AVAILABLE_REGIONS.includes(r as Region);

/**
 * Resolves the region list from config, expanding 'global' to all available regions.
 */
const resolveRegions = (configRegions?: string[] | null): Region[] => {
  if (configRegions?.includes('global') === true) return AVAILABLE_REGIONS;
  const valid = configRegions?.filter(isRegion);
  return valid && valid.length > 0 ? valid : AVAILABLE_REGIONS;
};

/**
 * Maps a V4 route definition to a NormalizedConfigRoute.
 */
const mapRoute = (
  route: NonNullable<ConfigV4['routes']>[number],
  entrypoints: readonly NormalizedConfigEntrypoint[]
): NormalizedConfigRoute => ({
  path: route.source,
  destination: route.destination,
  handler: resolveRouteHandler(route.destination, route.redirect, entrypoints),
  headers: route.headers ?? {},
  methods: route.methods ?? ['ANY'],
  positiveRequirements: route.has,
  negativeRequirements: route.missing,
  status: route.statusCode,
});

// -- Effectful helpers ------------------------------------------------------------------------

/** A `functions` entry with `runtime: docker`: its Dockerfile, and the container it becomes. */
interface DockerFunction {
  readonly file: string;
  readonly name: string;
  readonly container: ConfigV4Container;
}

/**
 * Resolves function entrypoints from the config's `functions` section.
 *
 * Files matched under `runtime: docker` are Dockerfiles. They are returned as
 * `dockerFunctions` instead, and become container functions alongside the
 * `containers` map.
 */
const parseEntrypoints = Effect.fn('parseEntrypoints')(function* (config: ConfigV4, projectFolder: string) {
  const entrypoints: NormalizedConfigEntrypoint[] = [];
  const dockerFunctions: DockerFunction[] = [];
  if (config.functions == null) return { entrypoints, dockerFunctions };

  for (const [fnPath, func] of Object.entries(config.functions)) {
    if (getFunctionSettings(fnPath, config) == null) {
      return yield* new FunctionConfigError({
        message: `Settings invalid for function at path '${fnPath}'`,
        functionPath: fnPath,
      });
    }

    const matchedFiles = yield* Effect.tryPromise({
      try: () => getFilesForPattern(fnPath, projectFolder, func.excludeFiles),
      catch: (error) =>
        new FunctionConfigError({
          message: `Failed to resolve files for function pattern '${fnPath}': ${error instanceof Error ? error.message : String(error)}`,
          functionPath: fnPath,
        }),
    });

    for (const file of matchedFiles) {
      if (entrypoints.some((ep) => ep.path === file)) continue;
      if (Object.keys(config.functions).some((f) => f === file && f !== fnPath)) continue;

      const settings = getFunctionSettings(file, config);
      if (settings == null) {
        return yield* new FunctionConfigError({
          message: `Settings invalid for function at path '${file}'`,
          functionPath: file,
        });
      }

      if (settings.runtime === CONTAINER_RUNTIME) {
        const unsupported = (['symlinks', 'includeFiles'] as const).filter((key) => settings[key] !== undefined);
        if (unsupported.length > 0) {
          return yield* new FunctionConfigError({
            message: `Function '${file}' runs a Dockerfile, so ${unsupported.join(' and ')} do not apply. Copy files in the Dockerfile instead.`,
            functionPath: file,
          });
        }
        // Only what the config declares: an unset `memory` takes the container default, not 128 MB.
        const declared = Object.entries(config.functions)
          .filter(([pattern]) => matchesPattern(file, pattern))
          .reduce<ConfigV4FunctionSettings>((merged, [, value]) => ({ ...merged, ...value }), {});
        dockerFunctions.push({
          file,
          name: dockerFunctionContainerName(file),
          container: {
            build: { context: posix.dirname(file), dockerfile: posix.basename(file) },
            ...(declared.port !== undefined && { port: declared.port }),
            ...(declared.memory !== undefined && { memory: declared.memory }),
            ...(declared.max_duration !== undefined && { max_duration: declared.max_duration }),
            ...(declared.streaming !== undefined && { streaming: declared.streaming }),
            ...(func.schedule !== undefined && { schedule: func.schedule }),
          },
        });
        continue;
      }
      if (settings.port !== undefined) {
        return yield* new FunctionConfigError({
          message: `Function '${file}' sets port, which only applies to 'runtime: docker'.`,
          functionPath: file,
        });
      }

      const runtime = settings.runtime ?? 'node-20';
      const streaming = settings.streaming ?? runtimeStreamsByDefault(runtime);

      entrypoints.push({
        path: file,
        runtime,
        memory: settings.memory ?? 128,
        maxDuration: settings.max_duration ?? DEFAULT_FUNCTION_DURATION_SECONDS,
        schedule: func.schedule,
        symlinks: func.symlinks,
        streaming,
        package:
          settings.includeFiles != null || settings.excludeFiles != null
            ? {
                includeFiles: toArray(settings.includeFiles),
                excludeFiles: toArray(settings.excludeFiles),
              }
            : undefined,
      });
    }
  }

  // Globs list files in directory order, so sort for a stable config.
  dockerFunctions.sort((left, right) => (left.file < right.file ? -1 : left.file > right.file ? 1 : 0));
  for (const [index, { file, name }] of dockerFunctions.entries()) {
    const clash = dockerFunctions.slice(0, index).find((candidate) => candidate.name === name);
    if (clash !== undefined) {
      return yield* new FunctionConfigError({
        message: `Functions '${clash.file}' and '${file}' would both be named '${name}'. Declare one of them under 'containers' with an explicit name.`,
        functionPath: file,
      });
    }
  }

  return { entrypoints, dockerFunctions };
});

/**
 * Collects static asset paths from the configured assets directory.
 */
const collectAssets = Effect.fn('collectAssets')(function* (config: ConfigV4, projectFolder: string) {
  if (config.assets == null) return [] as string[];

  const assetNames = yield* collectAssetFiles(projectFolder, config.assets);

  return assetNames
    .filter((assetName) => getFunctionSettings(`${config.assets}/${assetName}`, config) == null)
    .map((assetName) => `${config.assets}/${assetName}`);
});

/**
 * Ports a managed runtime binds inside the function microVM, which a sidecar
 * running next to it must not take: the guest runtime's HTTP port, and the
 * php-fpm port for PHP functions.
 */
const reservedRuntimePorts = (entrypoint: NormalizedConfigEntrypoint): number[] =>
  entrypoint.runtime === CONTAINER_RUNTIME ? [] : entrypoint.runtime.startsWith('php-') ? [8080, 9000] : [8080];

/**
 * Resolves the `compose` import and the `containers` map into container
 * entrypoints, sidecars and the routes a lone container function implies.
 */
const parseContainers = Effect.fn('parseContainers')(function* (
  config: ConfigV4,
  projectFolder: string,
  fileEntrypoints: readonly NormalizedConfigEntrypoint[],
  dockerFunctions: readonly DockerFunction[]
) {
  const warnings: string[] = [];
  let containers: Record<string, ConfigV4Container> = {};

  if (config.compose != null) {
    const imported = yield* readComposeContainers(config.compose, projectFolder);
    containers = imported.containers;
    warnings.push(...imported.warnings);
  }
  containers = { ...containers, ...(config.containers ?? {}) };
  for (const { file, name, container } of dockerFunctions) {
    if (containers[name] !== undefined) {
      return yield* new ContainerConfigError({
        message: `Function '${file}' runs as container '${name}', which 'containers' or the Compose file already declares. Rename one of them.`,
        containerName: name,
      });
    }
    containers[name] = container;
  }

  const result = yield* normalizeContainers(containers, projectFolder);
  warnings.push(...result.warnings);

  for (const entrypoint of fileEntrypoints) {
    for (const port of reservedRuntimePorts(entrypoint)) {
      const sidecar = result.sidecars.find((candidate) => candidate.port === port);
      if (sidecar !== undefined) {
        return yield* new ContainerConfigError({
          message: `Sidecar '${sidecar.name}' listens on port ${port}, which the ${entrypoint.runtime} runtime of '${entrypoint.path}' uses inside the same microVM. Choose another port.`,
          containerName: sidecar.name,
        });
      }
    }
  }

  return { ...result, warnings };
});

// -- Service ----------------------------------------------------------------------------------

export class V4ConfigParser extends Effect.Service<V4ConfigParser>()('V4ConfigParser', {
  accessors: true,

  effect: Effect.succeed({
    /**
     * Parses a ConfigV4 into a NormalizedConfig.
     *
     * @param config - The raw V4 config object
     * @param projectFolder - Absolute path to the project root
     */
    parse: Effect.fn('V4ConfigParser.parse')(function* (config: ConfigV4, projectFolder: string) {
      const { entrypoints: fileEntrypoints, dockerFunctions } = yield* parseEntrypoints(config, projectFolder);
      const containers = yield* parseContainers(config, projectFolder, fileEntrypoints, dockerFunctions);
      const entrypoints = [...fileEntrypoints, ...containers.entrypoints];
      const assets = yield* collectAssets(config, projectFolder);
      // A route reaches a `runtime: docker` function by its Dockerfile path, like any function file.
      const dockerFunctionPaths = new Map(
        dockerFunctions.map(({ file, name }) => [file, containerEntrypointPath(name)])
      );
      const routes = (config.routes ?? []).map((route) =>
        mapRoute(
          {
            ...route,
            destination: dockerFunctionPaths.get(normalizeRouteDestination(route.destination)) ?? route.destination,
          },
          entrypoints
        )
      );
      const warnings = [...containers.warnings];

      return {
        regions: resolveRegions(config.regions),
        assets: {
          paths: assets.sort(),
          prefixToStrip: (config.assets ?? '') + '/',
          dynamicRoutes: true,
          populateCache: config.populateAssetCache ?? false,
        },
        environmentVariables: config.env ?? {},
        commands: config.build_commands ?? [],
        images: normalizeImagePolicy(config.images),
        services: normalizeServices(config.services),
        ...(containers.sidecars.length > 0 && { sidecars: containers.sidecars }),
        entrypoints,
        errors: [],
        warnings,
        routes,
      };
    }),
  }),
}) {}

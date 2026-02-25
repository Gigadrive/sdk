import { FileSystem, Path } from '@effect/platform';
import { getFilesForPattern } from '@gigadrive/build-utils';
import { Effect } from 'effect';
import { minimatch } from 'minimatch';
import safeRegex from 'safe-regex2';
import { FunctionConfigError } from '../errors';
import type {
  NormalizedConfig,
  NormalizedConfigEntrypoint,
  NormalizedConfigRoute,
  NormalizedConfigRouteHandler,
} from '../normalized-config';
import { AVAILABLE_REGIONS, type Region } from '../regions';
import type { ConfigV4, ConfigV4FunctionSettings } from '../v4';

/**
 * Maximum directory nesting depth for asset collection.
 * Guards against symlink-induced infinite recursion where constructed paths
 * grow monotonically (e.g. `/assets/link/link/link/...`).
 */
const MAX_ASSET_DEPTH = 100;

const DISALLOWED_ASSET_EXTENSIONS = ['.htaccess', '.htpasswd'];

const DEFAULT_FUNCTION_SETTINGS: Required<Pick<ConfigV4FunctionSettings, 'memory' | 'max_duration'>> &
  Pick<ConfigV4FunctionSettings, 'schedule' | 'symlinks' | 'excludeFiles' | 'includeFiles'> = {
  memory: 128,
  max_duration: 30,
  schedule: undefined,
  symlinks: undefined,
  excludeFiles: undefined,
  includeFiles: undefined,
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
const resolveRouteHandler = (destination: string, redirect?: boolean): NormalizedConfigRouteHandler => {
  const isExternal =
    destination.toLowerCase().startsWith('http://') || destination.toLowerCase().startsWith('https://');

  if (redirect === true) return 'HTTP_REDIRECT';
  return isExternal ? 'HTTP_PROXY' : 'SERVERLESS_FUNCTION';
};

/**
 * Resolves the region list from config, expanding 'global' to all available regions.
 */
const resolveRegions = (configRegions?: string[] | null): Region[] => {
  if (configRegions?.includes('global') === true) return AVAILABLE_REGIONS;
  return (configRegions?.filter((r) => r !== 'global') ?? AVAILABLE_REGIONS) as Region[];
};

/**
 * Maps a V4 route definition to a NormalizedConfigRoute.
 */
const mapRoute = (route: NonNullable<ConfigV4['routes']>[number]): NormalizedConfigRoute => ({
  path: route.source,
  destination: route.destination,
  handler: resolveRouteHandler(route.destination, route.redirect),
  headers: route.headers ?? {},
  methods: route.methods ?? ['ANY'],
  positiveRequirements: route.has,
  negativeRequirements: route.missing,
  status: route.statusCode,
});

// -- Effectful helpers ------------------------------------------------------------------------

/**
 * Resolves function entrypoints from the config's `functions` section.
 */
const parseEntrypoints = Effect.fn('parseEntrypoints')(function* (config: ConfigV4, projectFolder: string) {
  const entrypoints: NormalizedConfigEntrypoint[] = [];
  if (config.functions == null) return entrypoints;

  for (const [fnPath, func] of Object.entries(config.functions)) {
    const settings = getFunctionSettings(fnPath, config);

    if (settings == null) {
      yield* new FunctionConfigError({
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

      entrypoints.push({
        path: file,
        runtime: settings!.runtime ?? 'node-20',
        memory: settings!.memory ?? 128,
        maxDuration: settings!.max_duration ?? 30,
        schedule: func.schedule,
        symlinks: func.symlinks,
        streaming:
          settings!.runtime == null || settings!.runtime.startsWith('node-') || settings!.runtime.startsWith('bun-'),
      });
    }
  }

  return entrypoints;
});

/**
 * Collects static asset paths from the configured assets directory.
 */
const collectAssets = Effect.fn('collectAssets')(function* (config: ConfigV4, projectFolder: string) {
  if (config.assets == null) return [] as string[];

  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;

  const assetsPath = pathService.join(projectFolder, config.assets);
  const assetsExist = yield* fs.exists(assetsPath).pipe(Effect.catchAll(() => Effect.succeed(false)));
  if (!assetsExist) return [] as string[];

  const stat = yield* fs.stat(assetsPath).pipe(Effect.catchAll(() => Effect.succeed(null)));
  if (!stat || stat.type !== 'Directory') return [] as string[];

  const allFiles = yield* collectFilesRecursively(assetsPath);
  const assets: string[] = [];

  for (const assetName of allFiles) {
    if (DISALLOWED_ASSET_EXTENSIONS.some((ext) => assetName.toLowerCase().endsWith(ext.toLowerCase()))) continue;
    if (getFunctionSettings(`${config.assets}/${assetName}`, config) != null) continue;

    assets.push(`${config.assets}/${assetName}`);
  }

  return assets;
});

/**
 * Recursively collects all file paths relative to the base directory.
 */
const collectFilesRecursively: (
  basePath: string,
  relativePath?: string,
  depth?: number
) => Effect.Effect<string[], never, FileSystem.FileSystem | Path.Path> = Effect.fn('collectFilesRecursively')(
  function* (basePath: string, relativePath: string = '', depth: number = 0) {
    if (depth > MAX_ASSET_DEPTH) return [] as string[];

    const fs = yield* FileSystem.FileSystem;
    const pathSvc = yield* Path.Path;

    const currentPath = relativePath ? pathSvc.join(basePath, relativePath) : basePath;

    const entries = yield* fs.readDirectory(currentPath).pipe(Effect.catchAll(() => Effect.succeed([] as string[])));
    const result: string[] = [];

    for (const name of entries) {
      const fullPath = pathSvc.join(currentPath, name);
      const entryRelative = relativePath ? pathSvc.join(relativePath, name) : name;
      const stat = yield* fs.stat(fullPath).pipe(Effect.catchAll(() => Effect.succeed(null)));

      if (!stat) continue;

      if (stat.type === 'Directory') {
        const nested = yield* collectFilesRecursively(basePath, entryRelative, depth + 1);
        result.push(...nested);
      } else {
        result.push(entryRelative);
      }
    }

    return result;
  }
);

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
      const entrypoints = yield* parseEntrypoints(config, projectFolder);
      const assets = yield* collectAssets(config, projectFolder);

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
        entrypoints,
        errors: [],
        warnings: [],
        routes: (config.routes ?? []).map(mapRoute),
      } as NormalizedConfig;
    }),
  }),
}) {}

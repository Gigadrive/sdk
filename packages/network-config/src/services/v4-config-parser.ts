import { FileSystem } from '@effect/platform';
import { getFilesForPattern } from '@gigadrive/build-utils';
import { Effect } from 'effect';
import { minimatch } from 'minimatch';
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
 * Gets the runtime, memory and max duration for a given path.
 * @param path
 * @param config
 * @returns The runtime, memory and max duration for the given path. Should return undefined when a path should not be deployed as a function.
 */
export const getFunctionSettings = (path: string, config: ConfigV4): ConfigV4FunctionSettings | undefined => {
  let functionSettings: ConfigV4FunctionSettings | undefined;

  for (const [key, value] of Object.entries(config.functions ?? {})) {
    if (minimatch(path, key) || new RegExp(key).test(path)) {
      if (functionSettings == null) {
        functionSettings = {
          memory: 128,
          max_duration: 30,
          schedule: undefined,
          symlinks: undefined,
          excludeFiles: undefined,
          includeFiles: undefined,
        };
      }

      if (value.runtime != null) {
        functionSettings.runtime = value.runtime;
      }

      if (value.memory != null) {
        functionSettings.memory = value.memory;
      }

      if (value.max_duration != null) {
        functionSettings.max_duration = value.max_duration;
      }

      if (value.schedule != null) {
        functionSettings.schedule = value.schedule;
      }

      if (value.symlinks != null) {
        functionSettings.symlinks = value.symlinks;
      }

      if (value.excludeFiles != null) {
        functionSettings.excludeFiles = value.excludeFiles;
      }

      if (value.includeFiles != null) {
        functionSettings.includeFiles = value.includeFiles;
      }
    }
  }

  return functionSettings;
};

export class V4ConfigParser extends Effect.Service<V4ConfigParser>()('V4ConfigParser', {
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    /**
     * Parses a ConfigV4 into a NormalizedConfig.
     *
     * @param config - The raw V4 config object
     * @param projectFolder - Absolute path to the project root
     */
    const parse = Effect.fn('V4ConfigParser.parse')(function* (config: ConfigV4, projectFolder: string) {
      const regions =
        config.regions?.includes('global') === true
          ? AVAILABLE_REGIONS
          : (config.regions?.filter((region) => region !== 'global') ?? ['global']);

      const populateAssetCache = config.populateAssetCache ?? false;
      const environmentVariables = config.env ?? {};
      const commands = config.build_commands ?? [];
      const entrypoints: NormalizedConfigEntrypoint[] = [];
      const errors: string[] = [];
      const warnings: string[] = [];

      if (config.functions != null) {
        for (const [fnPath, func] of Object.entries(config.functions)) {
          const settings = getFunctionSettings(fnPath, config);

          if (settings == null) {
            return yield* Effect.fail(
              new FunctionConfigError({
                message: `Settings invalid for function at path '${fnPath}'`,
                functionPath: fnPath,
              })
            );
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
            if (entrypoints.find((entrypoint) => entrypoint.path === file)) {
              continue;
            }

            if (config.functions != null && Object.keys(config.functions).find((f) => f === file && f !== fnPath)) {
              continue;
            }

            entrypoints.push({
              path: file,
              runtime: settings.runtime ?? 'node-20',
              memory: settings.memory ?? 128,
              maxDuration: settings.max_duration ?? 30,
              schedule: func.schedule,
              symlinks: func.symlinks,
              streaming:
                settings.runtime == null || settings.runtime.startsWith('node-') || settings.runtime.startsWith('bun-'),
            });
          }
        }
      }

      const assets: string[] = [];

      if (config.assets != null) {
        const assetsPath = `${projectFolder}/${config.assets}`;
        const assetsExist = yield* fs.exists(assetsPath).pipe(Effect.catchAll(() => Effect.succeed(false)));

        if (assetsExist) {
          const stat = yield* fs.stat(assetsPath).pipe(Effect.catchAll(() => Effect.succeed(null)));

          if (stat && stat.type === 'Directory') {
            const allFiles = yield* collectFilesRecursively(fs, assetsPath);

            const disallowedExtensions = ['.htaccess', '.htpasswd'];

            for (const assetName of allFiles) {
              if (disallowedExtensions.some((ext) => assetName.toLowerCase().endsWith(ext.toLowerCase()))) {
                continue;
              }

              if (getFunctionSettings(`${config.assets}/${assetName}`, config) != null) {
                continue;
              }

              assets.push(`${config.assets}/${assetName}`);
            }
          }
        }
      }

      const routes = config.routes ?? [];

      return {
        regions: regions as Region[],
        assets: {
          paths: assets.sort(),
          prefixToStrip: (config.assets ?? '') + '/',
          dynamicRoutes: true,
          populateCache: populateAssetCache,
        },
        environmentVariables,
        commands,
        entrypoints,
        errors,
        warnings,
        routes: routes.map((route) => {
          const handler: NormalizedConfigRouteHandler =
            route.destination.toLowerCase().startsWith('http://') ||
            route.destination.toLowerCase().startsWith('https://')
              ? route.redirect === true
                ? 'HTTP_REDIRECT'
                : 'HTTP_PROXY'
              : route.redirect === true
                ? 'HTTP_REDIRECT'
                : 'SERVERLESS_FUNCTION';

          return {
            path: route.source,
            destination: route.destination,
            handler,
            headers: route.headers ?? {},
            methods: route.methods ?? ['ANY'],
            positiveRequirements: route.has,
            negativeRequirements: route.missing,
            status: route.statusCode,
          } as NormalizedConfigRoute;
        }),
      } as NormalizedConfig;
    });

    return { parse };
  }),
}) {}

/**
 * Recursively collects all file paths relative to the base directory.
 */
const collectFilesRecursively = (
  fs: FileSystem.FileSystem,
  basePath: string,
  relativePath: string = ''
): Effect.Effect<string[], never, never> =>
  Effect.gen(function* () {
    const currentPath = relativePath ? `${basePath}/${relativePath}` : basePath;
    const entries = yield* fs.readDirectory(currentPath).pipe(Effect.catchAll(() => Effect.succeed([] as string[])));
    const result: string[] = [];

    for (const name of entries) {
      const fullPath = `${currentPath}/${name}`;
      const entryRelative = relativePath ? `${relativePath}/${name}` : name;
      const stat = yield* fs.stat(fullPath).pipe(Effect.catchAll(() => Effect.succeed(null)));

      if (!stat) continue;

      if (stat.type === 'Directory') {
        const nested = yield* collectFilesRecursively(fs, basePath, entryRelative);
        result.push(...nested);
      } else {
        result.push(entryRelative);
      }
    }

    return result;
  });

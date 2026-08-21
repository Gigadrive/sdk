import { Effect } from 'effect';
import { createJiti } from 'jiti';
import { ConfigModuleLoadError } from '../errors';

/** Sentinel distinguishing "module has no default export" from `export default undefined`. */
const MISSING_DEFAULT_EXPORT = Symbol('MissingDefaultExport');

export class ConfigModuleLoader extends Effect.Service<ConfigModuleLoader>()('ConfigModuleLoader', {
  effect: Effect.gen(function* () {
    /**
     * Evaluates a TypeScript config module (e.g. gigadrive.ts) and returns its
     * default export. Relative imports and node_modules are resolved from the
     * config file's own directory, so `import { defineConfig } from
     * '@gigadrive/network-config'` works when the package is installed in the
     * user's project.
     *
     * @param filePath - Absolute path to the config module
     * @returns The module's default export as a record
     */
    const loadConfigModule = Effect.fn('ConfigModuleLoader.loadConfigModule')(function* (filePath: string) {
      const mod = yield* Effect.tryPromise({
        try: async () => {
          const jiti = createJiti(filePath, { fsCache: false, interopDefault: true, moduleCache: false });
          const namespace: unknown = await jiti.import(filePath);
          if (typeof namespace === 'object' && namespace !== null && 'default' in namespace) {
            return namespace.default;
          }
          return MISSING_DEFAULT_EXPORT;
        },
        catch: (error) =>
          new ConfigModuleLoadError({
            message: `Failed to load config module at ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            filePath,
            cause: error instanceof Error ? error.message : undefined,
          }),
      });

      if (mod === MISSING_DEFAULT_EXPORT) {
        return yield* Effect.fail(
          new ConfigModuleLoadError({
            message: `Config module at ${filePath} does not have a default export. Export the config object as the default export (optionally wrapped in defineConfig).`,
            filePath,
          })
        );
      }

      if (typeof mod === 'function') {
        return yield* Effect.fail(
          new ConfigModuleLoadError({
            message: `Config module at ${filePath} default-exports a function; config factories are not supported. Export a config object instead (optionally wrapped in defineConfig).`,
            filePath,
          })
        );
      }

      if (typeof mod !== 'object' || mod === null || Array.isArray(mod)) {
        return yield* Effect.fail(
          new ConfigModuleLoadError({
            message: `Config module at ${filePath} must default-export a config object.`,
            filePath,
          })
        );
      }

      return mod as Record<string, unknown>;
    });

    return { loadConfigModule };
  }),
}) {}

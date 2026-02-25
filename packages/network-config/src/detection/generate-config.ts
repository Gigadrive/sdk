import { Effect } from 'effect';
import type { NormalizedConfig } from '../normalized-config';
import { AVAILABLE_REGIONS } from '../regions';
import type { FrameworkDefinition, PackageManager } from './types';

/**
 * Returns the install command for the given package manager.
 */
const getInstallCommand = (pm: PackageManager): string => {
  switch (pm) {
    case 'bun':
      return 'bun install';
    case 'pnpm':
      return 'pnpm install';
    case 'yarn':
      return 'yarn install';
    case 'composer':
      return 'composer install';
    case 'npm':
    default:
      return 'npm install';
  }
};

/**
 * Generates a NormalizedConfig from a framework definition and detected package manager.
 * Prepends the install command and builds a complete deployment configuration.
 *
 * @param framework - The detected framework definition
 * @param packageManager - The detected package manager
 * @returns A complete NormalizedConfig with framework defaults
 */
export const generateConfig = Effect.fn('generateConfig')(function* (
  framework: FrameworkDefinition,
  packageManager: PackageManager
) {
  const defaults = framework.getDefaultConfig(packageManager);

  const installCmd = defaults.installCommand ?? getInstallCommand(packageManager);
  const commands = [installCmd, ...defaults.commands];

  yield* Effect.logDebug(`Generating config for ${framework.name}`, {
    runtime: defaults.runtime,
    entrypoint: defaults.entrypoint,
    commands,
  });

  const entrypoints = defaults.entrypoint
    ? [
        {
          path: defaults.entrypoint,
          runtime: defaults.runtime,
          memory: defaults.memory,
          maxDuration: defaults.maxDuration,
          streaming: defaults.streaming,
          symlinks: defaults.symlinks,
        },
      ]
    : [];

  const routes = defaults.entrypoint
    ? defaults.routes.map((route) => ({
        path: route.source,
        destination: route.destination,
        handler: defaults.streaming ? ('SERVERLESS_FUNCTION_STREAMING' as const) : ('SERVERLESS_FUNCTION' as const),
        methods: ['ANY' as const],
        headers: {},
      }))
    : [];

  const config: NormalizedConfig = {
    regions: [...AVAILABLE_REGIONS],
    environmentVariables: { ...defaults.environmentVariables },
    commands,
    entrypoints,
    routes,
    excludeFiles: defaults.excludeFiles && defaults.excludeFiles.length > 0 ? [...defaults.excludeFiles] : undefined,
    warnings: [`Auto-detected framework: ${framework.name}. Create a gigadrive.yaml to customize.`],
    errors: [],
  };

  if (defaults.assetsDir) {
    config.assets = {
      paths: [],
      prefixToStrip: defaults.assetsDir + '/',
      dynamicRoutes: true,
      populateCache: defaults.populateAssetCache ?? false,
    };
  }

  return config;
});

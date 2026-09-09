import { Effect } from 'effect';
import { collectAssetFiles } from '../collect-asset-files';
import type { NormalizedConfig } from '../normalized-config';
import { AVAILABLE_REGIONS } from '../regions';
import type { FrameworkDefaultConfig, FrameworkDefinition, PackageManager } from './types';

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
 * Runs after the customer build, so a framework's `assetsDir` is resolved
 * against real build output.
 *
 * @param framework - The detected framework definition
 * @param packageManager - The detected package manager
 * @param projectFolder - Absolute path to the project root, used to enumerate `assetsDir`
 * @returns A complete NormalizedConfig with framework defaults
 */
export const generateConfig = Effect.fn('generateConfig')(function* (
  framework: FrameworkDefinition,
  packageManager: PackageManager,
  projectFolder: string,
  refinedDefaults?: FrameworkDefaultConfig
) {
  const defaults = refinedDefaults ?? framework.getDefaultConfig(packageManager);

  const installCmd = defaults.installCommand ?? getInstallCommand(packageManager);
  const commands = [installCmd, ...defaults.commands];

  yield* Effect.logDebug(`Generating config for ${framework.name}`, {
    runtime: defaults.runtime,
    entrypoint: defaults.entrypoint,
    commands,
  });

  const entrypoints =
    defaults.normalizedConfig?.entrypoints ??
    (defaults.entrypoint
      ? [
          {
            path: defaults.entrypoint,
            runtime: defaults.runtime,
            memory: defaults.memory,
            maxDuration: defaults.maxDuration,
            streaming: defaults.streaming,
            symlinks: defaults.symlinks,
            package: defaults.package,
          },
        ]
      : []);

  const routes =
    defaults.normalizedConfig?.routes ??
    (defaults.entrypoint
      ? defaults.routes.map((route) => ({
          path: route.source,
          destination: route.destination,
          handler: defaults.streaming ? ('SERVERLESS_FUNCTION_STREAMING' as const) : ('SERVERLESS_FUNCTION' as const),
          methods: ['ANY' as const],
          headers: {},
        }))
      : []);

  const config: NormalizedConfig = {
    regions: [...AVAILABLE_REGIONS],
    environmentVariables: { ...defaults.environmentVariables },
    commands,
    entrypoints,
    routes,
    excludeFiles: defaults.excludeFiles && defaults.excludeFiles.length > 0 ? [...defaults.excludeFiles] : undefined,
    warnings: [`Auto-detected framework: ${framework.name}. Create a gigadrive.yaml to customize.`],
    errors: [],
    ...defaults.normalizedConfig,
  };

  if (defaults.assetsDir || defaults.assetPaths || defaults.assetPrefixes || defaults.assetManifests) {
    const paths = defaults.assetPaths ? [...defaults.assetPaths] : [];
    const overrides: Record<string, { path?: string; contentType?: string }> = { ...defaults.assetOverrides };

    // With neither an entrypoint nor a route the deployment is nothing but
    // static files, so directory index files also answer their extensionless
    // path, the way every static host serves them. Anywhere a function or route
    // could own those paths, the index files keep their literal path.
    const servesDirectoryIndexes = entrypoints.length === 0 && routes.length === 0;

    // `assetsDir` is a framework's declaration that a build output directory
    // belongs on the edge, and nothing downstream expands it into files: a
    // detected framework that only set `assetsDir` used to deploy zero static
    // assets. Frameworks that resolve their own sources (Next.js, and any
    // prefix- or manifest-backed collection) keep them untouched.
    const assetsDir = defaults.assetsDir;
    if (assetsDir && !defaults.assetPaths && !defaults.assetPrefixes && !defaults.assetManifests) {
      for (const file of yield* collectAssetFiles(projectFolder, assetsDir)) {
        // A PHP framework's asset directory is its document root, so it also
        // holds the scripts the runtime executes. An exact-path asset route
        // outranks the front controller's wildcard, so publishing one would
        // serve its source instead of running it.
        if (framework.language === 'php' && /\.(php|phtml|phar)$/i.test(file)) continue;

        paths.push(`${assetsDir}/${file}`);

        // Overrides are keyed by the prefix-stripped path, which is the key
        // asset publication resolves them by.
        if (!servesDirectoryIndexes || file in overrides) continue;
        if (file === 'index.html') {
          overrides[file] = { path: '' };
        } else if (file.endsWith('/index.html')) {
          overrides[file] = { path: file.slice(0, -'/index.html'.length) };
        }
      }
    }

    config.assets = {
      paths,
      prefixToStrip: defaults.assetsPrefixToStrip ?? (defaults.assetsDir ? defaults.assetsDir + '/' : ''),
      overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
      prefixes: defaults.assetPrefixes ? defaults.assetPrefixes.map((prefix) => ({ ...prefix })) : undefined,
      manifests: defaults.assetManifests ? defaults.assetManifests.map((manifest) => ({ ...manifest })) : undefined,
      dynamicRoutes: true,
      populateCache: defaults.populateAssetCache ?? false,
    };
  }

  return config;
});

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
    case 'bundler':
      // BUNDLE_PATH, BUNDLE_WITHOUT and BUNDLE_DEPLOYMENT come from the build
      // environment, so the command carries no flags.
      return 'bundle install';
    case 'npm':
    default:
      return 'npm install';
  }
};

/** Composer files at the project root: the manifest, the lock and its credentials. */
const COMPOSER_ROOT_FILES = new Set(['composer.json', 'composer.lock', 'auth.json']);

/**
 * Whether a project-relative path is one a PHP document root must never
 * serve: any dot-segment (`.env`, `.git/`, `.htaccess`), a dependency
 * directory at the project root, or a root Composer file.
 */
const isPrivatePhpProjectFile = (projectPath: string) => {
  const segments = projectPath.split('/').filter((segment) => segment !== '' && segment !== '.');
  return (
    segments.some((segment) => segment.startsWith('.')) ||
    segments[0] === 'vendor' ||
    segments[0] === 'node_modules' ||
    (segments.length === 1 && COMPOSER_ROOT_FILES.has(segments[0] ?? ''))
  );
};

/** Bundler manifests and lockfiles, in either naming scheme. */
const BUNDLER_FILES = new Set(['Gemfile', 'Gemfile.lock', 'gems.rb', 'gems.locked']);

/**
 * Whether a project-relative path is one a Ruby application must never serve
 * as a static asset, even when its asset directory is the project root: any
 * dot-segment (`.env`, `.git/`, `.bundle/`), the project's `vendor/` tree
 * (where gems install), Ruby sources and rackup files, and Bundler manifests.
 */
const isPrivateRubyProjectFile = (projectPath: string) => {
  const segments = projectPath.split('/').filter((segment) => segment !== '' && segment !== '.');
  const fileName = segments.at(-1) ?? '';
  return (
    segments.some((segment) => segment.startsWith('.')) ||
    segments[0] === 'vendor' ||
    /\.(rb|ru)$/i.test(fileName) ||
    BUNDLER_FILES.has(fileName)
  );
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

  // An empty install command means there is nothing to install, e.g. PHP
  // files without a Composer manifest.
  const installCmd = defaults.installCommand ?? getInstallCommand(packageManager);
  const commands = installCmd ? [installCmd, ...defaults.commands] : [...defaults.commands];

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
        // A PHP document root can be the project root, which also holds the
        // dependencies and dotfiles (.env, .git) that must never be served.
        if (framework.language === 'php' && isPrivatePhpProjectFile(`${assetsDir}/${file}`)) continue;
        // A Ruby asset directory is normally `public/`, but one pointed at the
        // project root would otherwise publish the application's sources,
        // installed gems and credentials.
        if (framework.language === 'ruby' && isPrivateRubyProjectFile(`${assetsDir}/${file}`)) continue;

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

import { Effect } from 'effect';
import { CONTAINER_RUNTIME, type NormalizedConfig } from '../normalized-config';

/**
 * Merges framework defaults with a user-provided config.
 * User config always takes precedence; framework defaults fill gaps.
 *
 * - commands: use user's if non-empty, otherwise framework's
 * - entrypoints: use user's if non-empty, otherwise framework's. Container
 *   functions (`runtime: docker`) do not count: they are always kept, next to
 *   whichever file functions win, because a framework never declares them.
 * - routes: use user's if any of them targets something other than a container
 *   function, otherwise the framework's, preceded by the user's routes to
 *   container functions so that e.g. `/api/*` wins over a framework catch-all.
 *   With a managed framework kept, the user's routes always precede the
 *   framework's instead of replacing them.
 * - assets: use user's if it declares any sources, otherwise framework's. A
 *   kept managed framework always keeps its own assets, since its build output
 *   (e.g. `/_next/static/`) cannot be served without them.
 * - framework, sharedArtifacts: the framework's gateway metadata (only Next.js
 *   has any) is kept as long as the framework's functions are, because it
 *   describes those functions. Declaring file functions turns it off.
 * - images: use user's if set, otherwise framework's
 * - userArchive: always user's, so a CLI upload keeps the config file
 * - excludeFiles: use user's if non-empty, otherwise framework's
 * - regions: always use user's (always populated from parsing)
 * - environmentVariables: deep merge (framework base, user overrides)
 * - services: always use user's (frameworks don't define services)
 * - sidecars: always use user's (frameworks don't define sidecars)
 * - warnings/errors: concatenate both
 *
 * @param userConfig - The config parsed from the user's config file
 * @param frameworkConfig - The config generated from framework detection
 * @returns The merged config
 */
export const mergeWithFrameworkDefaults = Effect.fn('mergeWithFrameworkDefaults')(function* (
  userConfig: NormalizedConfig,
  frameworkConfig: NormalizedConfig
) {
  yield* Effect.logDebug('Merging user config with framework defaults');

  const userHasAssets =
    (userConfig.assets?.paths?.length ?? 0) > 0 ||
    (userConfig.assets?.prefixes?.length ?? 0) > 0 ||
    (userConfig.assets?.manifests?.length ?? 0) > 0;

  const isContainer = (entrypoint: NormalizedConfig['entrypoints'][number]) => entrypoint.runtime === CONTAINER_RUNTIME;
  const userFileFunctions = userConfig.entrypoints.filter((entrypoint) => !isContainer(entrypoint));
  const containerPaths = new Set(userConfig.entrypoints.filter(isContainer).map((entrypoint) => entrypoint.path));
  const targetsContainer = (route: NormalizedConfig['routes'][number]) =>
    containerPaths.has(route.destination.replace(/^\/+/, ''));

  // A managed framework (Next.js) carries gateway metadata that only makes
  // sense next to the functions it was generated for, so it survives the merge
  // exactly when the user declares no file functions of their own.
  const managedFramework = frameworkConfig.framework !== undefined;
  const keepsManagedFramework = managedFramework && userFileFunctions.length === 0;
  const managedWarnings = !managedFramework
    ? []
    : !keepsManagedFramework
      ? [
          'The Next.js integration is off because your config file declares its own functions. Remove them to keep Next.js routing, prerendering and image optimization.',
        ]
      : userHasAssets
        ? ['`assets` in your config file is ignored: Next.js publishes `.next/static` and `public` itself.']
        : [];

  const merged: NormalizedConfig = {
    regions: userConfig.regions,

    commands: userConfig.commands.length > 0 ? userConfig.commands : frameworkConfig.commands,

    entrypoints: [
      ...(userFileFunctions.length > 0 ? userFileFunctions : frameworkConfig.entrypoints),
      ...userConfig.entrypoints.filter(isContainer),
    ],

    routes:
      keepsManagedFramework || (containerPaths.size > 0 && userConfig.routes.every(targetsContainer))
        ? [...userConfig.routes, ...frameworkConfig.routes]
        : userConfig.routes.length > 0
          ? userConfig.routes
          : frameworkConfig.routes,

    assets: userHasAssets && !keepsManagedFramework ? userConfig.assets : frameworkConfig.assets,

    ...(keepsManagedFramework && {
      framework: frameworkConfig.framework,
      ...(frameworkConfig.sharedArtifacts !== undefined && { sharedArtifacts: frameworkConfig.sharedArtifacts }),
    }),
    ...((userConfig.images ?? frameworkConfig.images) !== undefined && {
      images: userConfig.images ?? frameworkConfig.images,
    }),

    environmentVariables: {
      ...frameworkConfig.environmentVariables,
      ...userConfig.environmentVariables,
    },

    excludeFiles:
      userConfig.excludeFiles && userConfig.excludeFiles.length > 0
        ? userConfig.excludeFiles
        : frameworkConfig.excludeFiles,

    services: userConfig.services,
    ...(userConfig.sidecars !== undefined && { sidecars: userConfig.sidecars }),
    // Never the framework's: a standalone archive root would upload only the
    // build output, leaving the config file and any container build context
    // behind. With a config file, the CLI uploads the project as before.
    userArchive: userConfig.userArchive,

    warnings: [...frameworkConfig.warnings, ...userConfig.warnings, ...managedWarnings],
    errors: [...frameworkConfig.errors, ...userConfig.errors],
  };

  return merged;
});

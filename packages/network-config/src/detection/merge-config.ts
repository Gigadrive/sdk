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
 * - assets: use user's if it declares any sources, otherwise framework's
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

  const merged: NormalizedConfig = {
    regions: userConfig.regions,

    commands: userConfig.commands.length > 0 ? userConfig.commands : frameworkConfig.commands,

    entrypoints: [
      ...(userFileFunctions.length > 0 ? userFileFunctions : frameworkConfig.entrypoints),
      ...userConfig.entrypoints.filter(isContainer),
    ],

    routes:
      containerPaths.size > 0 && userConfig.routes.every(targetsContainer)
        ? [...userConfig.routes, ...frameworkConfig.routes]
        : userConfig.routes.length > 0
          ? userConfig.routes
          : frameworkConfig.routes,

    assets: userHasAssets ? userConfig.assets : frameworkConfig.assets,

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
    userArchive: userConfig.userArchive,

    warnings: [...frameworkConfig.warnings, ...userConfig.warnings],
    errors: [...frameworkConfig.errors, ...userConfig.errors],
  };

  return merged;
});

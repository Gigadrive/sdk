import { Effect } from 'effect';
import type { NormalizedConfig } from '../normalized-config';

/**
 * Merges framework defaults with a user-provided config.
 * User config always takes precedence; framework defaults fill gaps.
 *
 * - commands: use user's if non-empty, otherwise framework's
 * - entrypoints: use user's if non-empty, otherwise framework's
 * - routes: use user's if non-empty, otherwise framework's
 * - assets: use user's if defined with paths, otherwise framework's
 * - excludeFiles: use user's if non-empty, otherwise framework's
 * - regions: always use user's (always populated from parsing)
 * - environmentVariables: deep merge (framework base, user overrides)
 * - services: always use user's (frameworks don't define services)
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

  const merged: NormalizedConfig = {
    regions: userConfig.regions,

    commands: userConfig.commands.length > 0 ? userConfig.commands : frameworkConfig.commands,

    entrypoints: userConfig.entrypoints.length > 0 ? userConfig.entrypoints : frameworkConfig.entrypoints,

    routes: userConfig.routes.length > 0 ? userConfig.routes : frameworkConfig.routes,

    assets: userConfig.assets?.paths && userConfig.assets.paths.length > 0 ? userConfig.assets : frameworkConfig.assets,

    environmentVariables: {
      ...frameworkConfig.environmentVariables,
      ...userConfig.environmentVariables,
    },

    excludeFiles:
      userConfig.excludeFiles && userConfig.excludeFiles.length > 0
        ? userConfig.excludeFiles
        : frameworkConfig.excludeFiles,

    services: userConfig.services,
    userArchive: userConfig.userArchive,

    warnings: [...frameworkConfig.warnings, ...userConfig.warnings],
    errors: [...frameworkConfig.errors, ...userConfig.errors],
  };

  return merged;
});

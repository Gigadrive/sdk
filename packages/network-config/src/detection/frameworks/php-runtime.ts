import { FileSystem, Path } from '@effect/platform';
import { Effect, Option } from 'effect';
import type { Runtime } from '../../runtime';
import type { FrameworkDefaultConfig, FrameworkDefinition } from '../types';
import { composerConstraintAllows } from './composer-constraint';

/**
 * The PHP runtimes a preset may pick, in order of preference, each with a
 * version standing in for the newest patch release it runs. `composer install`
 * checks `require.php` against that exact version, so `<=8.4` (which Composer
 * reads as `<=8.4.0`) must not pick `php-84`. `php-81` is deprecated and never
 * picked.
 */
const PHP_RUNTIME_CANDIDATES: Array<{ runtime: Runtime; newestVersion: string }> = [
  { runtime: 'php-84', newestVersion: '8.4.9999' },
  { runtime: 'php-83', newestVersion: '8.3.9999' },
];

/**
 * Picks the PHP runtime for a `composer.json` `require.php` constraint: the
 * newest supported runtime the constraint allows.
 *
 * @param constraint - The `require.php` constraint, e.g. `^8.2` or `~8.3.0`.
 * @returns The runtime, or `undefined` when the constraint cannot be parsed or
 *   allows none of the supported runtimes, so the preset keeps its default.
 */
export const phpRuntimeForConstraint = (constraint: string): Runtime | undefined =>
  PHP_RUNTIME_CANDIDATES.find(({ newestVersion }) => composerConstraintAllows(constraint, newestVersion) === true)
    ?.runtime;

/**
 * Reads the `require.php` constraint from a project's `composer.json`.
 *
 * @returns The constraint, or `None` when the manifest is missing, cannot be
 *   read or parsed, or requires no PHP version.
 */
const readPhpConstraint = (projectFolder: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;
    const content = yield* fs.readFileString(pathService.join(projectFolder, 'composer.json'));
    const manifest = yield* Effect.try(() => JSON.parse(content) as unknown);
    const requires = manifest && typeof manifest === 'object' && 'require' in manifest ? manifest.require : undefined;
    const php = requires && typeof requires === 'object' && 'php' in requires ? requires.php : undefined;
    return typeof php === 'string' ? Option.some(php) : Option.none();
  }).pipe(Effect.catchAll(() => Effect.succeed(Option.none<string>())));

/**
 * Sets the runtime of PHP defaults from the project's `composer.json`
 * `require.php` constraint (see {@link phpRuntimeForConstraint}). Without a
 * usable constraint the defaults keep their runtime.
 */
const refineComposerPhpRuntime = (defaults: FrameworkDefaultConfig, projectFolder: string) =>
  readPhpConstraint(projectFolder).pipe(
    Effect.map((constraint) => {
      const runtime = Option.getOrUndefined(Option.flatMapNullable(constraint, phpRuntimeForConstraint));
      return runtime ? { ...defaults, runtime } : defaults;
    })
  );

/**
 * Makes a PHP preset pick its runtime from `composer.json` `require.php`,
 * after the preset's own `refineDefaultConfig` (if any) has run. Applied to
 * every PHP preset in `FRAMEWORK_DEFINITIONS`, so a project requiring
 * `~8.3.0` runs on `php-83` rather than failing `composer install` on 8.4.
 */
export const withComposerPhpRuntime = (framework: FrameworkDefinition): FrameworkDefinition => ({
  ...framework,
  refineDefaultConfig: (defaults, projectFolder) =>
    Effect.gen(function* () {
      const refined = framework.refineDefaultConfig
        ? yield* framework.refineDefaultConfig(defaults, projectFolder)
        : defaults;
      return yield* refineComposerPhpRuntime(refined, projectFolder);
    }),
});

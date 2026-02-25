import type { NormalizedConfig } from '@gigadrive/network-config';
import {
  detectFramework,
  mergeWithFrameworkDefaults,
  parseConfig,
  postProcessConfig,
  RawConfigReader,
} from '@gigadrive/network-config';
import { Effect } from 'effect';
import { ConfigNotFoundError, ConfigParseError, ConfigValidationError } from '../errors';

// ---------------------------------------------------------------------------
// ProjectConfigService
// ---------------------------------------------------------------------------

export class ProjectConfigService extends Effect.Service<ProjectConfigService>()('ProjectConfigService', {
  accessors: true,

  effect: Effect.gen(function* () {
    const rawReader = yield* RawConfigReader;

    const resolve = Effect.fn('ProjectConfigService.resolve')(function* (cwd: string) {
      yield* Effect.annotateCurrentSpan('cwd', cwd);
      yield* Effect.log('Resolving project config', { cwd });

      const configPath = yield* rawReader.findConfig(cwd);

      // Attempt framework auto-detection
      const detection = yield* detectFramework(cwd).pipe(
        Effect.catchTag('FrameworkNotDetectedError', () => Effect.succeed(null))
      );

      if (detection) {
        yield* Effect.log('Framework auto-detected', {
          framework: detection.framework.name,
          slug: detection.framework.slug,
        });
      }

      let config: NormalizedConfig;
      let resolvedConfigPath: string | null = null;
      let framework: { name: string; slug: string } | undefined;

      if (configPath && detection) {
        // Case A: config file + framework detected → parse config, merge with framework defaults.
        // Note: parseConfig internally calls postProcessConfig on the user config (Vercel BOv3
        // merge, empty-deployment check, function/asset dedup). We intentionally do NOT re-run
        // postProcessConfig on the merged result because the Vercel BOv3 transform and validation
        // apply to the user's project output, not to framework defaults.
        yield* Effect.log('Config file found, merging with framework defaults', { configPath });
        resolvedConfigPath = configPath;

        const userConfig: NormalizedConfig = yield* parseConfig(configPath, cwd).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ConfigParseError({
                message: 'Failed to parse config file',
                cause: error.message,
              })
            )
          )
        );

        config = yield* mergeWithFrameworkDefaults(userConfig, detection.config);
        framework = { name: detection.framework.name, slug: detection.framework.slug };
      } else if (configPath) {
        // Case B: config file only → existing behavior
        yield* Effect.log('Config file found', { configPath });
        resolvedConfigPath = configPath;

        config = yield* parseConfig(configPath, cwd).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ConfigParseError({
                message: 'Failed to parse config file',
                cause: error.message,
              })
            )
          )
        );
      } else if (detection) {
        // Case C: no config file, framework detected → use detection + post-process
        config = yield* postProcessConfig(detection.config, cwd).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ConfigParseError({
                message: 'Failed to post-process auto-detected config',
                cause: error.message,
              })
            )
          )
        );

        framework = { name: detection.framework.name, slug: detection.framework.slug };
      } else {
        // Case D: neither config file nor framework detected
        return yield* Effect.fail(
          new ConfigNotFoundError({
            message: 'No config file found and no framework detected.',
            directory: cwd,
          })
        );
      }

      // Report warnings via structured logging
      for (const warning of config.warnings) {
        yield* Effect.logWarning(warning);
      }

      // Fail on config errors
      if (config.errors.length > 0) {
        return yield* Effect.fail(
          new ConfigValidationError({
            message: 'Config file has validation errors',
            errors: config.errors,
          })
        );
      }

      return { config, configPath: resolvedConfigPath, framework };
    });

    return { resolve };
  }),
}) {}

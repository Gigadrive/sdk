import type { NormalizedConfig } from '@gigadrive/network-config';
import { findConfig, parseConfig } from '@gigadrive/network-config';
import { Effect } from 'effect';
import { ConfigNotFoundError, ConfigParseError, ConfigValidationError } from '../errors';

// ---------------------------------------------------------------------------
// ProjectConfigService
// ---------------------------------------------------------------------------

export class ProjectConfigService extends Effect.Service<ProjectConfigService>()('ProjectConfigService', {
  accessors: true,

  effect: Effect.gen(function* () {
    const resolve = Effect.fn('ProjectConfigService.resolve')(function* (cwd: string) {
      yield* Effect.annotateCurrentSpan('cwd', cwd);
      yield* Effect.log('Resolving project config', { cwd });

      const configPath = findConfig(cwd);
      if (!configPath) {
        return yield* Effect.fail(
          new ConfigNotFoundError({
            message: 'The current project folder does not have a valid config file.',
            directory: cwd,
          })
        );
      }

      yield* Effect.log('Config file found', { configPath });

      const config: NormalizedConfig = yield* Effect.tryPromise({
        try: () => parseConfig(configPath, cwd),
        catch: (error) =>
          new ConfigParseError({
            message: 'Failed to parse config file',
            cause: error instanceof Error ? error.message : String(error),
          }),
      });

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

      return { config, configPath };
    });

    return { resolve };
  }),
}) {}

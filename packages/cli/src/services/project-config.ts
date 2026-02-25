import type {
  ConfigFileEmptyError,
  ConfigFileNotFoundError,
  ConfigFileParseError,
  ConfigSchemaValidationError,
  ConfigVersionError,
  FunctionConfigError,
  NormalizedConfig,
} from '@gigadrive/network-config';
import {
  detectFramework,
  mergeWithFrameworkDefaults,
  NetworkConfigLive,
  parseConfig,
  postProcessConfig,
  RawConfigReader,
} from '@gigadrive/network-config';
import { Effect } from 'effect';
import { ConfigNotFoundError, ConfigParseError, ConfigValidationError } from '../errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wraps parseConfig errors into the CLI's ConfigParseError type.
 */
type ParseConfigErrors =
  | ConfigFileNotFoundError
  | ConfigFileEmptyError
  | ConfigFileParseError
  | ConfigVersionError
  | ConfigSchemaValidationError
  | FunctionConfigError;

const wrapParseErrors = <R>(effect: Effect.Effect<NormalizedConfig, ParseConfigErrors, R>) =>
  effect.pipe(
    Effect.catchTags({
      ConfigFileNotFoundError: (e) => Effect.fail(new ConfigParseError({ message: e.message, cause: e.filePath })),
      ConfigFileEmptyError: (e) => Effect.fail(new ConfigParseError({ message: e.message, cause: e.filePath })),
      ConfigFileParseError: (e) => Effect.fail(new ConfigParseError({ message: e.message, cause: e.cause })),
      ConfigVersionError: (e) => Effect.fail(new ConfigParseError({ message: e.message, cause: e.filePath })),
      ConfigSchemaValidationError: (e) =>
        Effect.fail(new ConfigParseError({ message: e.message, cause: e.validationErrors.join(', ') })),
      FunctionConfigError: (e) => Effect.fail(new ConfigParseError({ message: e.message, cause: e.functionPath })),
    })
  );

// ---------------------------------------------------------------------------
// ProjectConfigService
// ---------------------------------------------------------------------------

export class ProjectConfigService extends Effect.Service<ProjectConfigService>()('ProjectConfigService', {
  accessors: true,
  dependencies: [NetworkConfigLive],

  effect: Effect.gen(function* () {
    const rawReader = yield* RawConfigReader;

    const resolve = Effect.fn('ProjectConfigService.resolve')(function* (cwd: string) {
      yield* Effect.annotateCurrentSpan('cwd', cwd);
      yield* Effect.log('Resolving project config', { cwd });

      const configPath = yield* rawReader.findConfig(cwd);

      // Attempt framework auto-detection.
      // When a user config exists, detection is best-effort — manifest read/parse
      // errors should not block resolution of the explicit config file.
      const detection = yield* detectFramework(cwd).pipe(
        Effect.catchTag('FrameworkNotDetectedError', () => Effect.succeed(null)),
        Effect.catchTag('ManifestReadError', (e) =>
          Effect.logWarning(`Skipping framework auto-detection: ${e.message}`).pipe(Effect.as(null))
        ),
        Effect.catchTag('ManifestParseError', (e) =>
          Effect.logWarning(`Skipping framework auto-detection: ${e.message}`).pipe(Effect.as(null))
        )
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

        const userConfig: NormalizedConfig = yield* wrapParseErrors(parseConfig(configPath, cwd));

        config = yield* mergeWithFrameworkDefaults(userConfig, detection.config);
        framework = { name: detection.framework.name, slug: detection.framework.slug };
      } else if (configPath) {
        // Case B: config file only → existing behavior
        yield* Effect.log('Config file found', { configPath });
        resolvedConfigPath = configPath;

        config = yield* wrapParseErrors(parseConfig(configPath, cwd));
      } else if (detection) {
        // Case C: no config file, framework detected → use detection + post-process
        config = yield* wrapParseErrors(postProcessConfig(detection.config, cwd));

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

import type {
  ConfigFileEmptyError,
  ConfigFileNotFoundError,
  ConfigFileParseError,
  ConfigModuleLoadError,
  ConfigSchemaValidationError,
  ConfigVersionError,
  ContainerConfigError,
  FunctionConfigError,
  NormalizedConfig,
} from '@gigadrive/network-config';
import {
  detectContainerProject,
  detectFramework,
  mergeWithFrameworkDefaults,
  NetworkConfigLive,
  parseConfig,
  parseConfigRaw,
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
  | ConfigModuleLoadError
  | ConfigVersionError
  | ConfigSchemaValidationError
  | ContainerConfigError
  | FunctionConfigError;

const wrapParseErrors = <A, R>(effect: Effect.Effect<A, ParseConfigErrors, R>) =>
  effect.pipe(
    Effect.catchTags({
      ConfigFileNotFoundError: (e) => Effect.fail(new ConfigParseError({ message: e.message, cause: e.filePath })),
      ConfigFileEmptyError: (e) => Effect.fail(new ConfigParseError({ message: e.message, cause: e.filePath })),
      ConfigFileParseError: (e) => Effect.fail(new ConfigParseError({ message: e.message, cause: e.cause })),
      ConfigModuleLoadError: (e) =>
        Effect.fail(new ConfigParseError({ message: e.message, cause: e.cause ?? e.filePath })),
      ConfigVersionError: (e) => Effect.fail(new ConfigParseError({ message: e.message, cause: e.filePath })),
      ConfigSchemaValidationError: (e) =>
        Effect.fail(new ConfigParseError({ message: e.message, cause: e.validationErrors.join(', ') })),
      FunctionConfigError: (e) => Effect.fail(new ConfigParseError({ message: e.message, cause: e.functionPath })),
      ContainerConfigError: (e) =>
        Effect.fail(new ConfigParseError({ message: e.message, cause: e.filePath ?? e.containerName })),
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
      // ManifestReadError / ManifestParseError indicate genuine problems (the
      // manifest file exists but is unreadable or malformed), so we surface them
      // as ConfigParseError instead of silently swallowing them.
      const detection = yield* detectFramework(cwd).pipe(
        Effect.catchTag('FrameworkNotDetectedError', () => Effect.succeed(null)),
        Effect.catchTag('ManifestReadError', (e) =>
          Effect.fail(new ConfigParseError({ message: `Framework detection failed: ${e.message}`, cause: e.filePath }))
        ),
        Effect.catchTag('ManifestParseError', (e) =>
          Effect.fail(new ConfigParseError({ message: `Framework detection failed: ${e.message}`, cause: e.filePath }))
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
        // Case A: config file + framework detected → parse raw (no post-processing), merge
        // with framework defaults, then post-process the merged result. Running postProcessConfig
        // after the merge ensures validations (empty-deployment check, Vercel BOv3 merge,
        // function/asset dedup) see the full picture instead of producing stale pre-merge errors.
        yield* Effect.log('Config file found, merging with framework defaults', { configPath });
        resolvedConfigPath = configPath;

        const userConfig: NormalizedConfig = yield* wrapParseErrors(parseConfigRaw(configPath, cwd));
        const merged: NormalizedConfig = yield* mergeWithFrameworkDefaults(userConfig, detection.config);

        config = yield* wrapParseErrors(postProcessConfig(merged, cwd));
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
        // Case D: neither config file nor framework → a Compose file or a root
        // Dockerfile deploys as container images. Tried last so a framework
        // project's local-development Compose file never replaces the framework.
        const containerProject = yield* wrapParseErrors(
          detectContainerProject(cwd).pipe(Effect.map((result) => result?.config ?? null))
        );
        if (containerProject === null) {
          return yield* Effect.fail(
            new ConfigNotFoundError({
              message: 'No config file, framework, Compose file or Dockerfile found.',
              directory: cwd,
            })
          );
        }

        config = yield* wrapParseErrors(postProcessConfig(containerProject, cwd));
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

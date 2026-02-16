import { Command } from '@effect/cli';
import { Console, Effect } from 'effect';
import { ProjectConfigService } from '../../../services/project-config';

export const debugConfigCommand = Command.make('config', {}, () =>
  Effect.gen(function* () {
    const projectConfig = yield* ProjectConfigService;
    const cwd = process.cwd();
    const { config, configPath } = yield* projectConfig.resolve(cwd);

    yield* Console.log(`Config file found at: ${configPath}`);
    yield* Console.log(JSON.stringify(config, null, 2));
  }).pipe(
    Effect.catchTags({
      ConfigNotFoundError: (err) => Console.error(err.message),
      ConfigParseError: (err) => Console.error(`Config parse error: ${err.message}`),
      ConfigValidationError: (err) =>
        Effect.gen(function* () {
          for (const e of err.errors) {
            yield* Console.error(e);
          }
          yield* Console.error(err.message);
        }),
    })
  )
);

import { Command } from '@effect/cli';
import { Console, Effect } from 'effect';
import { AuthService } from '../../services/auth';

export const loginCommand = Command.make('login', {}, () =>
  Effect.gen(function* () {
    yield* Console.log('Initiating login...');

    const auth = yield* AuthService;
    yield* auth.login;

    const info = yield* auth.getUserInfo.pipe(Effect.catchAll(() => Effect.succeed({} as Record<string, unknown>)));

    const name = auth.inferUserName(info);
    yield* Console.log(`You are now logged in as ${name}.`);
  }).pipe(
    Effect.catchTags({
      LoginFlowError: (err: { message: string }) => Console.error(`Login failed: ${err.message}`),
      TokenExchangeError: (err: { message: string }) => Console.error(`Login failed: ${err.message}`),
      OAuthDiscoveryError: (err: { message: string }) => Console.error(`Login failed: ${err.message}`),
      AuthStorageWriteError: (err: { message: string }) => Console.error(`Failed to save credentials: ${err.message}`),
    })
  )
);

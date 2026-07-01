import { Command } from '@effect/cli';
import { Console, Effect } from 'effect';
import { AuthService } from '../../services/auth';

/** `gigadrive logout` — clear stored credentials (`~/.gigadrive/auth.json`). */
export const logoutCommand = Command.make('logout', {}, () =>
  Effect.gen(function* () {
    const auth = yield* AuthService;
    yield* auth.logout;
    yield* Console.log('Logged out.');
  }).pipe(
    Effect.catchTags({
      AuthStorageWriteError: (err) =>
        Console.error(`Failed to log out: ${err.message}`).pipe(Effect.andThen(Effect.fail(err))),
    })
  )
);

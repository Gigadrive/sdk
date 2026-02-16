import { Command } from '@effect/cli';
import { Console, Effect } from 'effect';
import { AuthService } from '../../services/auth';

export const whoamiCommand = Command.make('whoami', {}, () =>
  Effect.gen(function* () {
    const auth = yield* AuthService;
    const info = yield* auth.getUserInfo;
    yield* Console.log(JSON.stringify(info, null, 2));
  }).pipe(
    Effect.catchTags({
      NotAuthenticatedError: () => Console.log('You are not logged in. Run "gigadrive login" to authenticate.'),
      UserInfoFetchError: (err) => Console.error(`Failed to retrieve user info: ${err.message}`),
      OAuthDiscoveryError: (err) => Console.error(`Failed to retrieve user info: ${err.message}`),
    })
  )
);

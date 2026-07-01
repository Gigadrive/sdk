import { Command, Options } from '@effect/cli';
import { Console, Effect, Option } from 'effect';
import { ApiClientService } from '../../services/api-client';

const orgOption = Options.text('org').pipe(
  Options.withAlias('o'),
  Options.withDescription('Only list applications belonging to this organization ID'),
  Options.optional
);

const appsListCommand = Command.make('list', { org: orgOption }, ({ org }) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const organizationId = Option.getOrUndefined(org);
    const { items, total } = yield* apiClient.request((client) => client.applications.list({ organizationId }));

    if (items.length === 0) {
      yield* Console.log('No applications found.');
      return;
    }

    for (const app of items) {
      yield* Console.log(`${app.id}  ${app.name}  (${app.organization.name})`);
    }
    yield* Console.log(`\n${total} application(s).`);
  }).pipe(
    Effect.catchTags({
      NotAuthenticatedError: (err) =>
        Console.error('You are not logged in. Run "gigadrive login" to authenticate.').pipe(
          Effect.andThen(Effect.fail(err))
        ),
      ApiRequestError: (err) =>
        Console.error(`Failed to list applications: ${err.message}`).pipe(Effect.andThen(Effect.fail(err))),
    })
  )
);

const appsBase = Command.make('apps', {}, () => Effect.void);

/** `gigadrive apps` — inspect the applications the authenticated actor can access. */
export const appsCommand = appsBase.pipe(Command.withSubcommands([appsListCommand]));

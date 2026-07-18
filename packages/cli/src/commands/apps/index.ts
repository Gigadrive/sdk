import { Command, Options } from '@effect/cli';
import { Console, Effect, Option } from 'effect';
import { ApiClientService } from '../../services/api-client';

const listOrgOption = Options.text('org').pipe(
  Options.withAlias('o'),
  Options.withDescription('Only list applications belonging to this organization ID'),
  Options.optional
);

const createOrgOption = Options.text('org').pipe(
  Options.withAlias('o'),
  Options.withDescription('Organization ID that will own the application')
);

const nameOption = Options.text('name').pipe(
  Options.withAlias('n'),
  Options.withDescription('Application display name')
);

const slugOption = Options.text('slug').pipe(
  Options.withDescription('Optional lowercase application slug'),
  Options.optional
);

const rootDirectoryOption = Options.text('root-directory').pipe(
  Options.withDescription('Optional project directory relative to the repository root'),
  Options.optional
);

const appsListCommand = Command.make('list', { org: listOrgOption }, ({ org }) =>
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

const appsCreateCommand = Command.make(
  'create',
  { org: createOrgOption, name: nameOption, slug: slugOption, rootDirectory: rootDirectoryOption },
  ({ org, name, slug, rootDirectory }) =>
    Effect.gen(function* () {
      const apiClient = yield* ApiClientService;
      const application = yield* apiClient.request((client) =>
        client.applications.create({
          organizationId: org,
          name,
          ...Option.match(slug, { onNone: () => ({}), onSome: (value) => ({ slug: value }) }),
          ...Option.match(rootDirectory, {
            onNone: () => ({}),
            onSome: (value) => ({ rootDirectory: value }),
          }),
        })
      );

      yield* Console.log(`Created application ${application.name} (${application.id}).`);
      yield* Console.log(`Run "gigadrive link --app ${application.id}" to link the current directory.`);
    }).pipe(
      Effect.catchTags({
        NotAuthenticatedError: (err) =>
          Console.error('You are not logged in. Run "gigadrive login" to authenticate.').pipe(
            Effect.andThen(Effect.fail(err))
          ),
        ApiRequestError: (err) =>
          Console.error(`Failed to create application: ${err.message}`).pipe(Effect.andThen(Effect.fail(err))),
      })
    )
);

const appsBase = Command.make('apps', {}, () => Effect.void);

/** `gigadrive apps` — create and inspect applications the authenticated actor can access. */
export const appsCommand = appsBase.pipe(Command.withSubcommands([appsListCommand, appsCreateCommand]));

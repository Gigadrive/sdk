import { Args, Command, Options } from '@effect/cli';
import { Console, Effect, Option } from 'effect';
import { EnvVarNotFoundError, InvalidEnvVarFormatError } from '../../errors';
import { ApiClientService } from '../../services/api-client';
import { ProjectLinkService } from '../../services/project-link';

const appOption = Options.text('app').pipe(
  Options.withAlias('a'),
  Options.withDescription('Operate on this application (overrides the linked application)'),
  Options.optional
);

const orgOption = Options.text('org').pipe(
  Options.withAlias('o'),
  Options.withDescription('Operate on this organization instead of an application'),
  Options.optional
);

const sensitiveOption = Options.boolean('sensitive').pipe(
  Options.withDescription('Store the value as sensitive (hidden in API responses)')
);

const envIdOption = Options.text('env').pipe(
  Options.withAlias('e'),
  Options.withDescription('Environment ID for an environment-scoped variable (application scope only)'),
  Options.optional
);

const keyValueArg = Args.text({ name: 'key=value' }).pipe(
  Args.withDescription('Variable assignment, e.g. DATABASE_URL=postgres://user:pass@host/db')
);

const keyOrIdArg = Args.text({ name: 'key-or-id' }).pipe(Args.withDescription('Variable key or ID to remove'));

/**
 * Resolve which resource the command operates on: an explicit `--org` selects
 * organization scope; otherwise application scope using `--app` or the linked
 * application. Fails with `ProjectNotLinkedError` when neither is available.
 */
const resolveScope = (app: Option.Option<string>, org: Option.Option<string>) =>
  Effect.gen(function* () {
    if (Option.isSome(org)) {
      return { kind: 'organization' as const, id: org.value };
    }
    const projectLink = yield* ProjectLinkService;
    const id = yield* Option.match(app, {
      onSome: (value) => Effect.succeed(value),
      onNone: () => projectLink.resolve(process.cwd()).pipe(Effect.map((link) => link.applicationId)),
    });
    return { kind: 'application' as const, id };
  });

const envListCommand = Command.make('list', { app: appOption, org: orgOption }, ({ app, org }) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const scope = yield* resolveScope(app, org);

    const { items } = yield* apiClient.request((client) =>
      scope.kind === 'organization'
        ? client.organizations.envVars.list(scope.id)
        : client.applications.envVars.list(scope.id)
    );

    if (items.length === 0) {
      yield* Console.log('No environment variables set.');
      return;
    }
    for (const v of items) {
      yield* Console.log(`${v.key}=${v.sensitive ? '***' : (v.value ?? '')}`);
    }
  }).pipe(
    Effect.catchTags({
      NotAuthenticatedError: (err) =>
        Console.error('You are not logged in. Run "gigadrive login" to authenticate.').pipe(
          Effect.andThen(Effect.fail(err))
        ),
      ApiRequestError: (err) =>
        Console.error(`Failed to list environment variables: ${err.message}`).pipe(Effect.andThen(Effect.fail(err))),
      ProjectNotLinkedError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
      ProjectLinkReadError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
    })
  )
);

const envSetCommand = Command.make(
  'set',
  { keyValue: keyValueArg, app: appOption, org: orgOption, sensitive: sensitiveOption, env: envIdOption },
  ({ keyValue, app, org, sensitive, env }) =>
    Effect.gen(function* () {
      const separator = keyValue.indexOf('=');
      if (separator <= 0) {
        return yield* Effect.fail(
          new InvalidEnvVarFormatError({
            message: 'Invalid format. Use KEY=VALUE, e.g. "gigadrive env set DATABASE_URL=postgres://...".',
          })
        );
      }
      const key = keyValue.slice(0, separator);
      const value = keyValue.slice(separator + 1);

      const apiClient = yield* ApiClientService;
      const scope = yield* resolveScope(app, org);
      const environmentId = Option.getOrUndefined(env);

      const created = yield* apiClient.request((client) =>
        scope.kind === 'organization'
          ? client.organizations.envVars.create(scope.id, { key, value, sensitive })
          : client.applications.envVars.create(scope.id, { key, value, sensitive, environmentId })
      );
      yield* Console.log(`Set ${created.key}.`);
    }).pipe(
      Effect.catchTags({
        InvalidEnvVarFormatError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
        NotAuthenticatedError: (err) =>
          Console.error('You are not logged in. Run "gigadrive login" to authenticate.').pipe(
            Effect.andThen(Effect.fail(err))
          ),
        ApiRequestError: (err) =>
          Console.error(`Failed to set environment variable: ${err.message}`).pipe(Effect.andThen(Effect.fail(err))),
        ProjectNotLinkedError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
        ProjectLinkReadError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
      })
    )
);

const envRmCommand = Command.make(
  'rm',
  { keyOrId: keyOrIdArg, app: appOption, org: orgOption },
  ({ keyOrId, app, org }) =>
    Effect.gen(function* () {
      const apiClient = yield* ApiClientService;
      const scope = yield* resolveScope(app, org);

      const { items } = yield* apiClient.request((client) =>
        scope.kind === 'organization'
          ? client.organizations.envVars.list(scope.id)
          : client.applications.envVars.list(scope.id)
      );

      const target = items.find((v) => v.id === keyOrId || v.key === keyOrId);
      if (target === undefined) {
        return yield* Effect.fail(
          new EnvVarNotFoundError({ message: `No environment variable matching "${keyOrId}".` })
        );
      }

      yield* apiClient.request((client) =>
        scope.kind === 'organization'
          ? client.organizations.envVars.delete(scope.id, target.id)
          : client.applications.envVars.delete(scope.id, target.id)
      );
      yield* Console.log(`Removed ${target.key}.`);
    }).pipe(
      Effect.catchTags({
        EnvVarNotFoundError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
        NotAuthenticatedError: (err) =>
          Console.error('You are not logged in. Run "gigadrive login" to authenticate.').pipe(
            Effect.andThen(Effect.fail(err))
          ),
        ApiRequestError: (err) =>
          Console.error(`Failed to remove environment variable: ${err.message}`).pipe(Effect.andThen(Effect.fail(err))),
        ProjectNotLinkedError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
        ProjectLinkReadError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
      })
    )
);

const envBase = Command.make('env', {}, () => Effect.void);

/** `gigadrive env` — manage environment variables for the linked app or an organization. */
export const envCommand = envBase.pipe(Command.withSubcommands([envListCommand, envSetCommand, envRmCommand]));

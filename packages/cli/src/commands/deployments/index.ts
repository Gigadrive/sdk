import { Args, Command, Options } from '@effect/cli';
import { Console, Effect, Option } from 'effect';
import { ApiClientService } from '../../services/api-client';
import { ProjectLinkService } from '../../services/project-link';

const DEPLOYMENT_STATUSES = ['PENDING', 'QUEUED', 'STARTING', 'BUILDING', 'PROVISIONING', 'ACTIVE', 'FAILED'] as const;

const appOption = Options.text('app').pipe(
  Options.withAlias('a'),
  Options.withDescription('Filter by application ID (defaults to the linked application)'),
  Options.optional
);

const orgOption = Options.text('org').pipe(
  Options.withAlias('o'),
  Options.withDescription('Filter by organization ID'),
  Options.optional
);

const statusOption = Options.choice('status', DEPLOYMENT_STATUSES).pipe(
  Options.withAlias('s'),
  Options.withDescription('Filter by deployment status'),
  Options.optional
);

/**
 * Resolve the application filter: an explicit `--app` wins, otherwise fall back
 * to the linked application (when the directory is linked). Never fails — an
 * unlinked directory simply yields no application filter.
 */
const resolveApplicationFilter = (app: Option.Option<string>) =>
  Option.match(app, {
    onSome: (id) => Effect.succeed<string | undefined>(id),
    onNone: () =>
      Effect.gen(function* () {
        const projectLink = yield* ProjectLinkService;
        const link = yield* projectLink.load(process.cwd()).pipe(Effect.catchAll(() => Effect.succeed(Option.none())));
        return Option.match(link, { onNone: () => undefined, onSome: (l) => l.applicationId });
      }),
  });

const deploymentsListCommand = Command.make(
  'list',
  { app: appOption, org: orgOption, status: statusOption },
  ({ app, org, status }) =>
    Effect.gen(function* () {
      const apiClient = yield* ApiClientService;
      const applicationId = yield* resolveApplicationFilter(app);

      const { items, total } = yield* apiClient.request((client) =>
        client.deployments.list({
          applicationId,
          organizationId: Option.getOrUndefined(org),
          status: Option.getOrUndefined(status),
        })
      );

      if (items.length === 0) {
        yield* Console.log('No deployments found.');
        return;
      }

      for (const d of items) {
        yield* Console.log(`${d.id}  ${d.status.padEnd(12)}  ${d.createdAt}`);
      }
      yield* Console.log(`\n${total} deployment(s).`);
    }).pipe(
      Effect.catchTags({
        NotAuthenticatedError: () => Console.error('You are not logged in. Run "gigadrive login" to authenticate.'),
        ApiRequestError: (err) => Console.error(`Failed to list deployments: ${err.message}`),
      })
    )
);

const deploymentIdArg = Args.text({ name: 'deployment-id' }).pipe(Args.withDescription('The deployment ID to inspect'));

const deploymentsInspectCommand = Command.make('inspect', { deploymentId: deploymentIdArg }, ({ deploymentId }) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;

    const deployment = yield* apiClient.request((client) => client.deployments.get(deploymentId));
    yield* Console.log(`ID:          ${deployment.id}`);
    yield* Console.log(`Application:  ${deployment.applicationId}`);
    yield* Console.log(`Status:      ${deployment.status}`);
    yield* Console.log(`Created:     ${deployment.createdAt}`);
    yield* Console.log(`Updated:     ${deployment.updatedAt}`);

    const hostnames = yield* apiClient
      .request((client) => client.deployments.getHostnames(deploymentId))
      .pipe(Effect.catchAll(() => Effect.succeed({ items: [], total: 0 })));
    if (hostnames.items.length > 0) {
      yield* Console.log('Hostnames:');
      for (const h of hostnames.items) {
        yield* Console.log(`  https://${h.hostname}${h.active ? '' : ' (inactive)'}`);
      }
    }
  }).pipe(
    Effect.catchTags({
      NotAuthenticatedError: () => Console.error('You are not logged in. Run "gigadrive login" to authenticate.'),
      ApiRequestError: (err) => Console.error(`Failed to inspect deployment: ${err.message}`),
    })
  )
);

const deploymentsBase = Command.make('deployments', {}, () => Effect.void);

/** `gigadrive deployments` — list and inspect deployments. */
export const deploymentsCommand = deploymentsBase.pipe(
  Command.withSubcommands([deploymentsListCommand, deploymentsInspectCommand])
);

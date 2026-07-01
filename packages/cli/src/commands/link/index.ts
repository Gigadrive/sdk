import { Command, Options, Prompt } from '@effect/cli';
import { Console, Effect, Option } from 'effect';
import { ApiClientService } from '../../services/api-client';
import { ProjectLinkService } from '../../services/project-link';

const appOption = Options.text('app').pipe(
  Options.withAlias('a'),
  Options.withDescription('Application ID to link (skips the interactive picker)'),
  Options.optional
);

const orgOption = Options.text('org').pipe(
  Options.withAlias('o'),
  Options.withDescription('Only list applications belonging to this organization ID'),
  Options.optional
);

/**
 * `gigadrive link` — associate the current directory with an application by
 * writing `.gigadrive/project.json`. Deploy and the resource commands read it.
 */
export const linkCommand = Command.make('link', { app: appOption, org: orgOption }, ({ app, org }) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const projectLink = yield* ProjectLinkService;
    const cwd = process.cwd();

    const organizationId = Option.getOrUndefined(org);
    const { items: apps } = yield* apiClient.request((client) => client.applications.list({ organizationId }));

    if (apps.length === 0) {
      yield* Console.error(
        'No applications found. Create one in the Gigadrive console, then run "gigadrive link" again.'
      );
      return;
    }

    const explicitAppId = Option.getOrUndefined(app);

    let applicationId: string;
    let linkedOrganizationId: string | undefined;

    if (explicitAppId !== undefined) {
      const match = apps.find((a) => a.id === explicitAppId);
      if (match === undefined) {
        yield* Console.error(`Application "${explicitAppId}" was not found among your applications.`);
        return;
      }
      applicationId = match.id;
      linkedOrganizationId = match.organization.id;
    } else if (apps.length === 1) {
      applicationId = apps[0].id;
      linkedOrganizationId = apps[0].organization.id;
    } else {
      const chosen = yield* Prompt.run(
        Prompt.select({
          message: 'Select an application to link',
          choices: apps.map((a) => ({ title: `${a.name} (${a.organization.name})`, value: a })),
        })
      );
      applicationId = chosen.id;
      linkedOrganizationId = chosen.organization.id;
    }

    yield* projectLink.save(cwd, { applicationId, organizationId: linkedOrganizationId });

    yield* Console.log(`Linked this directory to application ${applicationId}.`);
    yield* Console.log('Tip: add ".gigadrive/" to your .gitignore.');
  }).pipe(
    Effect.catchTags({
      QuitException: () => Console.log('Cancelled.'),
      NotAuthenticatedError: () => Console.error('You are not logged in. Run "gigadrive login" to authenticate.'),
      ApiRequestError: (err) => Console.error(`Failed to list applications: ${err.message}`),
      ProjectLinkWriteError: (err) => Console.error(err.message),
    })
  )
);

/** `gigadrive unlink` — remove the current directory's `.gigadrive/project.json`. */
export const unlinkCommand = Command.make('unlink', {}, () =>
  Effect.gen(function* () {
    const projectLink = yield* ProjectLinkService;
    yield* projectLink.remove(process.cwd());
    yield* Console.log('Unlinked this directory.');
  }).pipe(
    Effect.catchTags({
      ProjectLinkWriteError: (err) => Console.error(err.message),
    })
  )
);

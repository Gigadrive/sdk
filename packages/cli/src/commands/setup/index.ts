import { Args, Command, Options, Prompt } from '@effect/cli';
import { Console, Effect, Option } from 'effect';
import { ApplicationNotFoundError, NoApplicationsFoundError } from '../../errors';
import { ApiClientService } from '../../services/api-client';
import { EnvFileService } from '../../services/env-file';
import { LocalCredentialsService } from '../../services/local-credentials';
import { ProjectLinkService } from '../../services/project-link';

const fileArg = Args.text({ name: 'file' }).pipe(
  Args.withDescription('Output file to write (default: .env.local)'),
  Args.optional
);

const appOption = Options.text('app').pipe(
  Options.withAlias('a'),
  Options.withDescription('Application ID to set up (skips the interactive picker)'),
  Options.optional
);

const orgOption = Options.text('org').pipe(
  Options.withAlias('o'),
  Options.withDescription('Only list applications belonging to this organization ID when picking'),
  Options.optional
);

const environmentOption = Options.text('environment').pipe(
  Options.withAlias('e'),
  Options.withDescription('Environment slug to resolve overrides for (e.g. preview)'),
  Options.optional
);

const yesOption = Options.boolean('yes').pipe(
  Options.withAlias('y'),
  Options.withDescription('Overwrite an existing file without confirmation')
);

const rotateOption = Options.boolean('rotate').pipe(
  Options.withDescription('Force a fresh API key, revoking the previous one')
);

/**
 * `gigadrive setup` — one command to wire up a local dev environment: ensures the
 * directory is linked to an application (prompting if needed), pulls the
 * application's non-sensitive environment variables, provisions least-privilege
 * API credentials, and writes everything to `.env.local`.
 */
export const setupCommand = Command.make(
  'setup',
  {
    file: fileArg,
    app: appOption,
    org: orgOption,
    environment: environmentOption,
    yes: yesOption,
    rotate: rotateOption,
  },
  ({ file, app, org, environment, yes, rotate }) =>
    Effect.gen(function* () {
      const apiClient = yield* ApiClientService;
      const projectLink = yield* ProjectLinkService;
      const envFile = yield* EnvFileService;
      const localCredentials = yield* LocalCredentialsService;
      const cwd = process.cwd();

      // 1. Ensure the directory is linked to an application.
      const existingLink = yield* projectLink.load(cwd);
      let applicationId: string;
      if (Option.isSome(existingLink)) {
        applicationId = existingLink.value.applicationId;
      } else {
        const organizationId = Option.getOrUndefined(org);
        const { items: apps } = yield* apiClient.request((client) => client.applications.list({ organizationId }));
        if (apps.length === 0) {
          return yield* Effect.fail(
            new NoApplicationsFoundError({
              message: 'No applications found. Create one in the Gigadrive console, then run "gigadrive setup" again.',
            })
          );
        }

        const explicitAppId = Option.getOrUndefined(app);
        let chosen: (typeof apps)[number];
        if (explicitAppId !== undefined) {
          const match = apps.find((a) => a.id === explicitAppId);
          if (match === undefined) {
            return yield* Effect.fail(
              new ApplicationNotFoundError({
                message: `Application "${explicitAppId}" was not found among your applications.`,
              })
            );
          }
          chosen = match;
        } else if (apps.length === 1) {
          chosen = apps[0];
        } else {
          chosen = yield* Prompt.run(
            Prompt.select({
              message: 'Select an application to set up',
              choices: apps.map((a) => ({ title: `${a.name} (${a.organization.name})`, value: a })),
            })
          );
        }

        applicationId = chosen.id;
        yield* projectLink.save(cwd, { applicationId, organizationId: chosen.organization.id });
        yield* Console.log(`Linked this directory to application ${applicationId}.`);
      }

      const target = Option.getOrElse(file, () => '.env.local');
      const environmentSlug = Option.getOrUndefined(environment);

      // 2. Pull the application's non-sensitive environment variables.
      const { items, omittedSensitive } = yield* apiClient.request((client) =>
        client.applications.envVars.pull(applicationId, environmentSlug ? { environment: environmentSlug } : undefined)
      );

      // 3. Confirm overwrite (reading first so credentials can be reused).
      const existing = yield* envFile.read(target);
      if (Option.isSome(existing) && !yes) {
        const overwrite = yield* Prompt.run(
          Prompt.confirm({ message: `${target} already exists. Overwrite?`, initial: false })
        );
        if (!overwrite) {
          return yield* Console.log('Cancelled.');
        }
      }

      // 4. Provision least-privilege API credentials.
      const credentialEntries = yield* localCredentials.provision({
        applicationId,
        rotate,
        existingContent: Option.getOrUndefined(existing),
      });

      // 5. Write the combined file and keep it out of git.
      const entries = [...items.map((v) => ({ key: v.key, value: v.value })), ...credentialEntries];
      yield* envFile.write(target, entries);
      const gitignored = yield* envFile.ensureGitignored(cwd, target);

      // 6. Print next steps.
      yield* Console.log('\nLocal dev environment ready.');
      yield* Console.log(`  • Wrote ${items.length} variable(s) and API credentials to ${target}.`);
      if (omittedSensitive > 0) {
        yield* Console.log(
          `  • Skipped ${omittedSensitive} sensitive variable(s) (only production/preview hold secrets).`
        );
      }
      if (gitignored) {
        yield* Console.log(`  • Added ${target} to .gitignore.`);
      }
      yield* Console.log('  • Your app can now call the Gigadrive API via the SDK (GIGADRIVE_CLIENT_ID/SECRET).');
    }).pipe(
      Effect.catchTags({
        // Ctrl+C during a prompt is a deliberate cancel — exit 0.
        QuitException: () => Console.log('Cancelled.'),
        NotAuthenticatedError: (err) =>
          Console.error('You are not logged in. Run "gigadrive login" to authenticate.').pipe(
            Effect.andThen(Effect.fail(err))
          ),
        ApiRequestError: (err) => Console.error(`Setup failed: ${err.message}`).pipe(Effect.andThen(Effect.fail(err))),
        NoApplicationsFoundError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
        ApplicationNotFoundError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
        ProjectLinkReadError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
        ProjectLinkWriteError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
        EnvFileReadError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
        EnvFileWriteError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
        DevCredentialsStoreReadError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
        DevCredentialsStoreWriteError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
      })
    )
);

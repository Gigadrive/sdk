import { Command, Options, Prompt } from '@effect/cli';
import { FileSystem, Path } from '@effect/platform';
import { formatFileSize } from '@gigadrive/commons';
import { Console, Duration, Effect, Option, Schedule, Stream } from 'effect';
import * as os from 'node:os';
import * as path from 'node:path';
import type { DeploymentId, DeploymentLog, DeploymentStatus } from '../../../domain';
import { DeploymentFailedError, NoOrganizationsFoundError, UploadPartError } from '../../../errors';
import { ApiClientService } from '../../../services/api-client';
import { ArchiveService } from '../../../services/archive';
import { DeploymentApiService } from '../../../services/deployment-api';
import { ProjectConfigService } from '../../../services/project-config';
import { ProjectLinkService } from '../../../services/project-link';

const appOption = Options.text('app').pipe(
  Options.withAlias('a'),
  Options.withDescription('Application ID to deploy to (overrides the linked application)'),
  Options.optional
);

const orgOption = Options.text('org').pipe(
  Options.withAlias('o'),
  Options.withDescription('Organization ID to use when automatically creating an application'),
  Options.optional
);

const nameOption = Options.text('name').pipe(
  Options.withAlias('n'),
  Options.withDescription('Application name to use when automatically creating an application'),
  Options.optional
);

interface DeploymentApplicationInput {
  app: Option.Option<string>;
  org: Option.Option<string>;
  name: Option.Option<string>;
  cwd: string;
}

const createAndLinkDeploymentApplication = (input: DeploymentApplicationInput) =>
  Effect.gen(function* () {
    const projectLink = yield* ProjectLinkService;
    const apiClient = yield* ApiClientService;
    const { items: organizations } = yield* apiClient.request((client) => client.organizations.list());
    const availableOrganizations = Option.match(input.org, {
      onNone: () => organizations,
      onSome: (organizationId) => organizations.filter((organization) => organization.id === organizationId),
    });

    if (availableOrganizations.length === 0) {
      return yield* new NoOrganizationsFoundError({
        message: Option.match(input.org, {
          onNone: () =>
            'No organization is available for this deployment. Create an organization, then run "gigadrive deploy" again.',
          onSome: (organizationId) => `Organization "${organizationId}" was not found among your organizations.`,
        }),
      });
    }

    const organization =
      availableOrganizations.length === 1
        ? availableOrganizations[0]
        : yield* Prompt.run(
            Prompt.select({
              message: 'Select an organization for this application',
              choices: availableOrganizations.map((candidate) => ({
                title: candidate.name,
                value: candidate,
              })),
            })
          );

    const inferredName = path.basename(input.cwd) || 'Application';
    const applicationName = Option.match(input.name, {
      onNone: () => inferredName,
      onSome: (name) => name,
    }).trim();
    const application = yield* apiClient.request((client) =>
      client.applications.create({
        organizationId: organization.id,
        name: applicationName || inferredName,
      })
    );

    yield* projectLink.save(input.cwd, {
      applicationId: application.id,
      organizationId: organization.id,
    });
    yield* Console.log(`Created and linked application ${application.name} (${application.id}).`);
    return application.id;
  });

const resolveLinkedDeploymentApplication = (input: DeploymentApplicationInput) =>
  Effect.gen(function* () {
    const projectLink = yield* ProjectLinkService;
    const existingLink = yield* projectLink.load(input.cwd);
    return yield* Option.match(existingLink, {
      onNone: () => createAndLinkDeploymentApplication(input),
      onSome: (link) => Effect.succeed(link.applicationId),
    });
  });

/**
 * Resolves the application for a deployment, automatically creating and
 * linking one when the current directory has no project link.
 *
 * An explicit application ID always wins. Otherwise an existing local link is
 * reused. For a new project, the authenticated actor's sole organization is
 * selected automatically; multiple organizations trigger an interactive
 * picker unless `--org` identifies one. The created link makes subsequent
 * deploys non-interactive.
 *
 * @param input - Command options and the current project directory.
 * @returns The application UUID that should own the deployment.
 */
export const resolveDeploymentApplication = (input: DeploymentApplicationInput) =>
  Option.match(input.app, {
    onNone: () => resolveLinkedDeploymentApplication(input),
    onSome: Effect.succeed,
  });

export const deployCommand = Command.make(
  'deploy',
  { app: appOption, org: orgOption, name: nameOption },
  ({ app, org, name }) =>
    Effect.gen(function* () {
      const projectConfig = yield* ProjectConfigService;
      const deploymentApi = yield* DeploymentApiService;
      const archiveService = yield* ArchiveService;
      const pathService = yield* Path.Path;

      const cwd = process.cwd();

      // Resolve and validate config
      yield* Effect.log('Starting deploy command');
      const { config } = yield* projectConfig.resolve(cwd);

      const applicationId = yield* resolveDeploymentApplication({ app, org, name, cwd });

      // Create deployment
      yield* Console.log('Creating deployment...');
      const deploymentId = yield* deploymentApi.createDeployment(applicationId);
      yield* Console.log(`Deployment ID: ${deploymentId}`);

      // Create and upload archive
      yield* Console.log('Creating archive...');
      const archivePath = pathService.join(os.tmpdir(), `project-${Date.now()}.zip`);
      const archive = yield* archiveService.createZipArchive(config.userArchive?.rootOverwrite || cwd, archivePath, {
        whitelist: config.userArchive?.fileWhitelist,
        excludeFiles: config.excludeFiles,
      });
      yield* Console.log(`Archive created (${formatFileSize(archive.size)})`);

      // Upload archive
      yield* Console.log('Uploading archive...');
      yield* uploadArchive(deploymentId, archivePath, archive.size);
      yield* Console.log('Upload complete.');
      yield* Console.log('The deployment pipeline is now being provisioned. This may take a few seconds.');

      // Poll for status and logs
      yield* pollDeployment(deploymentId);
    }).pipe(
      Effect.catchTags({
        QuitException: () => Console.log('Cancelled.'),
        NotAuthenticatedError: (err) =>
          Console.error('You are not logged in. Run "gigadrive login" to authenticate.').pipe(
            Effect.andThen(Effect.fail(err))
          ),
        ApiRequestError: (err) =>
          Console.error(`Application setup failed: ${err.message}`).pipe(Effect.andThen(Effect.fail(err))),
        NoOrganizationsFoundError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
        ProjectLinkReadError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
        ProjectLinkWriteError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
        ConfigNotFoundError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
        ConfigParseError: (err) =>
          Console.error(`Config parse error: ${err.message}`).pipe(Effect.andThen(Effect.fail(err))),
        ConfigValidationError: (err) =>
          Effect.gen(function* () {
            for (const e of err.errors) {
              yield* Console.error(e);
            }
            yield* Console.error(err.message);
          }).pipe(Effect.andThen(Effect.fail(err))),
        DeploymentCreateError: (err) =>
          Console.error(`Deployment creation failed: ${err.message}`).pipe(Effect.andThen(Effect.fail(err))),
        ArchiveCreateError: (err) =>
          Console.error(`Archive creation failed: ${err.message}`).pipe(Effect.andThen(Effect.fail(err))),
        UploadStartError: (err) =>
          Console.error(`Upload failed: ${err.message}`).pipe(Effect.andThen(Effect.fail(err))),
        UploadPartError: (err) => Console.error(`Upload failed: ${err.message}`).pipe(Effect.andThen(Effect.fail(err))),
        UploadCompleteError: (err) =>
          Console.error(`Upload failed: ${err.message}`).pipe(Effect.andThen(Effect.fail(err))),
        PresignedUrlError: (err) =>
          Console.error(`Upload failed: ${err.message}`).pipe(Effect.andThen(Effect.fail(err))),
        DeploymentAuthError: (err) =>
          Console.error(`Authentication failed: ${err.message}`).pipe(Effect.andThen(Effect.fail(err))),
        DeploymentFailedError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
      })
    )
);

// ---------------------------------------------------------------------------
// Upload archive helper
// ---------------------------------------------------------------------------

const uploadArchive = (deploymentId: DeploymentId, archivePath: string, fileSize: number) =>
  Effect.gen(function* () {
    const deploymentApi = yield* DeploymentApiService;
    const fs = yield* FileSystem.FileSystem;

    const uploadId = yield* deploymentApi.startMultipartUpload(deploymentId);

    const FILE_CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB
    const numChunks = Math.ceil(fileSize / FILE_CHUNK_SIZE);

    yield* Effect.log('Starting multipart upload', { uploadId, numChunks, fileSize });

    // Upload all chunks — each chunk is streamed from disk independently
    const parts = yield* Effect.all(
      Array.from({ length: numChunks }, (_, i) => {
        const partNumber = i + 1;
        const start = i * FILE_CHUNK_SIZE;
        const bytesToRead = partNumber < numChunks ? FILE_CHUNK_SIZE : fileSize - start;

        return Effect.gen(function* () {
          const presignedUrl = yield* deploymentApi.getPresignedUrl(deploymentId, uploadId, partNumber);

          // Stream only this chunk from disk to keep memory bounded
          const chunkData = yield* Stream.runCollect(fs.stream(archivePath, { offset: start, bytesToRead })).pipe(
            Effect.map((chunks) => {
              const arrays = Array.from(chunks);
              return Buffer.concat(arrays);
            }),
            Effect.mapError(
              (error) =>
                new UploadPartError({
                  message: `Failed to read chunk ${partNumber}: ${String(error)}`,
                  partNumber,
                })
            )
          );

          yield* Effect.log(`Uploading part ${partNumber}/${numChunks}`, { size: chunkData.length });
          return yield* deploymentApi.uploadPart(presignedUrl, chunkData, partNumber);
        });
      }),
      { concurrency: 3 }
    );

    yield* deploymentApi.completeUpload(deploymentId, uploadId, parts);
  });

// ---------------------------------------------------------------------------
// Poll deployment status + logs
// ---------------------------------------------------------------------------

const pollDeployment = (deploymentId: DeploymentId) =>
  Effect.gen(function* () {
    const deploymentApi = yield* DeploymentApiService;
    let lastStatus: DeploymentStatus = 'PENDING';
    let logOffset = 0;

    yield* Console.log('Status: Pending');

    // Poll in a loop until terminal status
    yield* Effect.repeat(
      Effect.gen(function* () {
        // Check status
        const newStatus = yield* deploymentApi
          .getDeploymentStatus(deploymentId)
          .pipe(Effect.catchTag('DeploymentStatusError', () => Effect.succeed(lastStatus)));

        if (newStatus !== lastStatus) {
          lastStatus = newStatus;
          const label = newStatus.charAt(0) + newStatus.slice(1).toLowerCase();
          yield* Console.log(`Status: ${label}`);
        }

        // Fetch logs
        const logsPage = yield* deploymentApi
          .getLogs(deploymentId, { offset: logOffset, limit: 100 })
          .pipe(Effect.catchTag('DeploymentLogsFetchError', () => Effect.succeed(null)));

        if (logsPage) {
          for (const logEntry of logsPage.items) {
            logOffset++;
            yield* printLog(logEntry);
          }
        }

        // Check terminal states
        if (newStatus === 'ACTIVE') {
          // Print the real per-deployment `*.gigadrive.app` hostname. Hostname
          // lookup is best-effort — a failure here must not fail a successful deploy.
          const hostnames = yield* deploymentApi
            .getHostnames(deploymentId)
            .pipe(Effect.catchTag('DeploymentHostnamesFetchError', () => Effect.succeed([])));
          const active = hostnames.find((h) => h.active) ?? hostnames.at(0);
          if (active) {
            yield* Console.log(`Deployed to https://${active.hostname}`);
          } else {
            yield* Console.log('Deployment is live.');
          }
          return yield* Effect.fail('done' as const);
        }

        if (newStatus === 'FAILED') {
          return yield* Effect.fail(
            new DeploymentFailedError({
              message: 'The deployment failed. Please check the logs for more information.',
            })
          );
        }
      }),
      Schedule.addDelay(Schedule.forever, () => Duration.seconds(1))
    ).pipe(
      Effect.catchAll((err) => {
        if (err === 'done') return Effect.void;
        return Effect.fail(err);
      })
    );
  });

const printLog = (logEntry: DeploymentLog) => {
  switch (logEntry.type) {
    case 'ERROR':
      return Console.error(logEntry.message);
    case 'WARN':
      return Console.warn(logEntry.message);
    default:
      return Console.log(logEntry.message);
  }
};

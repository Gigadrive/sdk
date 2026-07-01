import { Command, Options } from '@effect/cli';
import { FileSystem, Path } from '@effect/platform';
import { formatFileSize } from '@gigadrive/commons';
import { Console, Duration, Effect, Option, Schedule, Stream } from 'effect';
import * as os from 'node:os';
import type { DeploymentId, DeploymentLog, DeploymentStatus } from '../../../domain';
import { DeploymentFailedError, UploadPartError } from '../../../errors';
import { ArchiveService } from '../../../services/archive';
import { DeploymentApiService } from '../../../services/deployment-api';
import { ProjectConfigService } from '../../../services/project-config';
import { ProjectLinkService } from '../../../services/project-link';

const appOption = Options.text('app').pipe(
  Options.withAlias('a'),
  Options.withDescription('Application ID to deploy to (overrides the linked application)'),
  Options.optional
);

export const deployCommand = Command.make('deploy', { app: appOption }, ({ app }) =>
  Effect.gen(function* () {
    const projectConfig = yield* ProjectConfigService;
    const deploymentApi = yield* DeploymentApiService;
    const archiveService = yield* ArchiveService;
    const projectLink = yield* ProjectLinkService;
    const pathService = yield* Path.Path;

    const cwd = process.cwd();

    // Resolve the target application: an explicit --app wins, otherwise the app
    // linked to this directory via `gigadrive link`.
    const applicationId = yield* Option.match(app, {
      onSome: (id) => Effect.succeed(id),
      onNone: () => projectLink.resolve(cwd).pipe(Effect.map((link) => link.applicationId)),
    });

    // Resolve and validate config
    yield* Effect.log('Starting deploy command');
    const { config } = yield* projectConfig.resolve(cwd);

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
      useIgnoreFiles: false,
      useManagedIgnore: false,
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
      ProjectNotLinkedError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
      ProjectLinkReadError: (err) => Console.error(err.message).pipe(Effect.andThen(Effect.fail(err))),
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
      UploadStartError: (err) => Console.error(`Upload failed: ${err.message}`).pipe(Effect.andThen(Effect.fail(err))),
      UploadPartError: (err) => Console.error(`Upload failed: ${err.message}`).pipe(Effect.andThen(Effect.fail(err))),
      UploadCompleteError: (err) =>
        Console.error(`Upload failed: ${err.message}`).pipe(Effect.andThen(Effect.fail(err))),
      PresignedUrlError: (err) => Console.error(`Upload failed: ${err.message}`).pipe(Effect.andThen(Effect.fail(err))),
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

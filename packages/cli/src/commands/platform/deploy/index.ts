import { Command } from '@effect/cli';
import { formatFileSize } from '@gigadrive/commons';
import { Console, Duration, Effect, Schedule } from 'effect';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { DeploymentId, DeploymentLog, DeploymentStatus } from '../../../domain';
import { DeploymentFailedError, UploadPartError } from '../../../errors';
import { ArchiveService } from '../../../services/archive';
import { DeploymentApiService } from '../../../services/deployment-api';
import { ProjectConfigService } from '../../../services/project-config';

export const deployCommand = Command.make('deploy', {}, () =>
  Effect.gen(function* () {
    const projectConfig = yield* ProjectConfigService;
    const deploymentApi = yield* DeploymentApiService;
    const archiveService = yield* ArchiveService;

    const cwd = process.cwd();

    // Resolve and validate config
    yield* Effect.log('Starting deploy command');
    const { config } = yield* projectConfig.resolve(cwd);

    // Create deployment
    yield* Console.log('Creating deployment...');
    const deploymentId = yield* deploymentApi.createDeployment('test'); // TODO: real application ID
    yield* Console.log(`Deployment ID: ${deploymentId}`);

    // Create and upload archive
    yield* Console.log('Creating archive...');
    const archivePath = path.join(os.tmpdir(), `project-${Date.now()}.zip`);
    const archive = yield* archiveService.createZipArchive(config.userArchive?.rootOverwrite || cwd, archivePath, {
      whitelist: config.userArchive?.fileWhitelist,
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
      ConfigNotFoundError: (err) => Console.error(err.message),
      ConfigParseError: (err) => Console.error(`Config parse error: ${err.message}`),
      ConfigValidationError: (err) =>
        Effect.gen(function* () {
          for (const e of err.errors) {
            yield* Console.error(e);
          }
          yield* Console.error(err.message);
        }),
      DeploymentCreateError: (err) => Console.error(`Deployment creation failed: ${err.message}`),
      ArchiveCreateError: (err) => Console.error(`Archive creation failed: ${err.message}`),
      UploadStartError: (err) => Console.error(`Upload failed: ${err.message}`),
      UploadPartError: (err) => Console.error(`Upload failed: ${err.message}`),
      UploadCompleteError: (err) => Console.error(`Upload failed: ${err.message}`),
      PresignedUrlError: (err) => Console.error(`Upload failed: ${err.message}`),
      DeploymentFailedError: (err) => Console.error(err.message),
    }),
    Effect.catchAll((err) => Console.error(`Unexpected error: ${String(err)}`))
  )
);

// ---------------------------------------------------------------------------
// Upload archive helper
// ---------------------------------------------------------------------------

const uploadArchive = (deploymentId: DeploymentId, archivePath: string, fileSize: number) =>
  Effect.gen(function* () {
    const deploymentApi = yield* DeploymentApiService;

    const uploadId = yield* deploymentApi.startMultipartUpload(deploymentId);

    const FILE_CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB
    const numChunks = Math.ceil(fileSize / FILE_CHUNK_SIZE);

    yield* Effect.log('Starting multipart upload', { uploadId, numChunks, fileSize });

    // Upload all chunks
    const parts = yield* Effect.all(
      Array.from({ length: numChunks }, (_, i) => {
        const partNumber = i + 1;
        const start = i * FILE_CHUNK_SIZE;
        const end = partNumber < numChunks ? (i + 1) * FILE_CHUNK_SIZE : undefined;

        return Effect.gen(function* () {
          const presignedUrl = yield* deploymentApi.getPresignedUrl(deploymentId, uploadId, partNumber);

          // Read chunk
          const buffer = yield* Effect.tryPromise({
            try: () =>
              new Promise<Buffer>((resolve, reject) => {
                const readStream = fs.createReadStream(archivePath, {
                  start,
                  end: end !== undefined ? end - 1 : undefined,
                });
                const chunks: Buffer[] = [];
                readStream.on('data', (chunk: Buffer | string) => {
                  chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
                });
                readStream.on('end', () => resolve(Buffer.concat(chunks)));
                readStream.on('error', reject);
              }),
            catch: (error) =>
              new UploadPartError({
                message: `Failed to read chunk ${partNumber}: ${error instanceof Error ? error.message : String(error)}`,
                partNumber,
              }),
          });

          yield* Effect.log(`Uploading part ${partNumber}/${numChunks}`, { size: buffer.length });
          return yield* deploymentApi.uploadPart(presignedUrl, buffer, partNumber);
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
          yield* Console.log(`Deployed to https://${deploymentId}.gigadrivedev.com`);
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

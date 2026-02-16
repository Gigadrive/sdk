import { objectToQueryString } from '@gigadrive/commons';
import { Config, Effect, Schema } from 'effect';
import type { DeploymentId, DeploymentLogPage, UploadId } from '../domain';
import {
  DeploymentCreateError,
  DeploymentLogsFetchError,
  DeploymentStatusError,
  PresignedUrlError,
  UploadCompleteError,
  UploadPartError,
  UploadStartError,
} from '../errors';

// ---------------------------------------------------------------------------
// API response schemas
// ---------------------------------------------------------------------------

const CreateDeploymentResponse = Schema.Struct({ id: Schema.String });
const StartUploadResponse = Schema.Struct({ uploadId: Schema.String });
const PresignedUrlResponse = Schema.Struct({ url: Schema.String });
const DeploymentStatusResponse = Schema.Struct({
  status: Schema.Literal('PENDING', 'BUILDING', 'PROVISIONING', 'FAILED', 'ACTIVE', 'SUSPENDED'),
});
const DeploymentLogPageResponse = Schema.Struct({
  totalItems: Schema.Number,
  limit: Schema.Number,
  offset: Schema.Number,
  items: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      message: Schema.String,
      type: Schema.Literal('INFO', 'ERROR', 'WARN'),
      createdAt: Schema.String,
    })
  ),
});

// ---------------------------------------------------------------------------
// DeploymentApiService
// ---------------------------------------------------------------------------

const ApiBaseUrl = Config.string('GIGADRIVE_API_BASE_URL').pipe(Config.withDefault('http://localhost:3000'));

export class DeploymentApiService extends Effect.Service<DeploymentApiService>()('DeploymentApiService', {
  accessors: true,

  effect: Effect.gen(function* () {
    const baseUrl = yield* ApiBaseUrl;

    const createDeployment = Effect.fn('DeploymentApiService.createDeployment')(function* (applicationId: string) {
      yield* Effect.annotateCurrentSpan('applicationId', applicationId);
      yield* Effect.log('Creating deployment', { applicationId });

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(`${baseUrl}/${applicationId}/deployments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }),
        catch: (error) =>
          new DeploymentCreateError({
            message: `Failed to create deployment: ${error instanceof Error ? error.message : String(error)}`,
          }),
      });

      if (!response.ok) {
        const body = yield* Effect.tryPromise({
          try: () => response.text(),
          catch: () =>
            new DeploymentCreateError({
              message: 'Failed to read deployment creation error',
              statusCode: response.status,
            }),
        });
        return yield* Effect.fail(
          new DeploymentCreateError({
            message: `Failed to create deployment: ${body}`,
            statusCode: response.status,
          })
        );
      }

      const json = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: () => new DeploymentCreateError({ message: 'Failed to parse deployment response' }),
      });

      const decoded = yield* Schema.decodeUnknown(CreateDeploymentResponse)(json).pipe(
        Effect.mapError(() => new DeploymentCreateError({ message: 'Invalid deployment response schema' }))
      );

      yield* Effect.log('Deployment created', { deploymentId: decoded.id });
      return decoded.id as DeploymentId;
    });

    const startMultipartUpload = Effect.fn('DeploymentApiService.startMultipartUpload')(function* (
      deploymentId: DeploymentId
    ) {
      yield* Effect.annotateCurrentSpan('deploymentId', deploymentId);

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(`${baseUrl}/deployments/${deploymentId}/pre-signed-url/start`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }),
        catch: (error) =>
          new UploadStartError({
            message: `Failed to start multipart upload: ${error instanceof Error ? error.message : String(error)}`,
          }),
      });

      if (!response.ok) {
        const body = yield* Effect.tryPromise({
          try: () => response.text(),
          catch: () => new UploadStartError({ message: 'Failed to read upload start error' }),
        });
        return yield* Effect.fail(
          new UploadStartError({ message: `Failed to start multipart upload: ${body}`, statusCode: response.status })
        );
      }

      const json = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: () => new UploadStartError({ message: 'Failed to parse upload start response' }),
      });

      const decoded = yield* Schema.decodeUnknown(StartUploadResponse)(json).pipe(
        Effect.mapError(() => new UploadStartError({ message: 'Invalid upload start response schema' }))
      );

      return decoded.uploadId as UploadId;
    });

    const getPresignedUrl = Effect.fn('DeploymentApiService.getPresignedUrl')(function* (
      deploymentId: DeploymentId,
      uploadId: UploadId,
      partNumber: number
    ) {
      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(
            `${baseUrl}/deployments/${deploymentId}/pre-signed-url/part?uploadId=${uploadId}&partNumber=${partNumber}`,
            {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            }
          ),
        catch: (error) =>
          new PresignedUrlError({
            message: `Failed to get presigned URL: ${error instanceof Error ? error.message : String(error)}`,
            partNumber,
          }),
      });

      if (!response.ok) {
        const body = yield* Effect.tryPromise({
          try: () => response.text(),
          catch: () => new PresignedUrlError({ message: 'Failed to read presigned URL error', partNumber }),
        });
        return yield* Effect.fail(
          new PresignedUrlError({ message: `Failed to get presigned URL: ${body}`, partNumber })
        );
      }

      const json = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: () => new PresignedUrlError({ message: 'Failed to parse presigned URL response', partNumber }),
      });

      const decoded = yield* Schema.decodeUnknown(PresignedUrlResponse)(json).pipe(
        Effect.mapError(() => new PresignedUrlError({ message: 'Invalid presigned URL response schema', partNumber }))
      );

      return decoded.url;
    });

    const uploadPart = Effect.fn('DeploymentApiService.uploadPart')(function* (
      presignedUrl: string,
      data: Buffer,
      partNumber: number
    ) {
      yield* Effect.annotateCurrentSpan('partNumber', partNumber);
      yield* Effect.annotateCurrentSpan('size', data.length);

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(presignedUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/zip',
              'Content-Length': String(data.length),
            },
            body: data,
          }),
        catch: (error) =>
          new UploadPartError({
            message: `Failed to upload part ${partNumber}: ${error instanceof Error ? error.message : String(error)}`,
            partNumber,
          }),
      });

      if (!response.ok) {
        return yield* Effect.fail(
          new UploadPartError({
            message: `Failed to upload part ${partNumber}: ${response.statusText}`,
            partNumber,
          })
        );
      }

      const etag = response.headers.get('ETag');
      if (!etag) {
        return yield* Effect.fail(
          new UploadPartError({ message: `No ETag received for part ${partNumber}`, partNumber })
        );
      }

      return { partNumber, etag };
    });

    const completeUpload = Effect.fn('DeploymentApiService.completeUpload')(function* (
      deploymentId: DeploymentId,
      uploadId: UploadId,
      parts: Array<{ partNumber: number; etag: string }>
    ) {
      yield* Effect.annotateCurrentSpan('deploymentId', deploymentId);
      yield* Effect.annotateCurrentSpan('partsCount', parts.length);

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(`${baseUrl}/deployments/${deploymentId}/pre-signed-url/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uploadId, parts }),
          }),
        catch: (error) =>
          new UploadCompleteError({
            message: `Failed to complete upload: ${error instanceof Error ? error.message : String(error)}`,
          }),
      });

      if (!response.ok) {
        const body = yield* Effect.tryPromise({
          try: () => response.text(),
          catch: () => new UploadCompleteError({ message: 'Failed to read upload complete error' }),
        });
        return yield* Effect.fail(new UploadCompleteError({ message: `Failed to complete upload: ${body}` }));
      }

      yield* Effect.log('Upload completed successfully');
    });

    const getDeploymentStatus = Effect.fn('DeploymentApiService.getDeploymentStatus')(function* (
      deploymentId: DeploymentId
    ) {
      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(`${baseUrl}/deployments/${deploymentId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }),
        catch: (error) =>
          new DeploymentStatusError({
            message: `Failed to get deployment status: ${error instanceof Error ? error.message : String(error)}`,
          }),
      });

      if (!response.ok) {
        const body = yield* Effect.tryPromise({
          try: () => response.text(),
          catch: () => new DeploymentStatusError({ message: 'Failed to read deployment status error' }),
        });
        return yield* Effect.fail(new DeploymentStatusError({ message: `Failed to get deployment status: ${body}` }));
      }

      const json = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: () => new DeploymentStatusError({ message: 'Failed to parse deployment status response' }),
      });

      const decoded = yield* Schema.decodeUnknown(DeploymentStatusResponse)(json).pipe(
        Effect.mapError(() => new DeploymentStatusError({ message: 'Invalid deployment status response schema' }))
      );

      return decoded.status;
    });

    const getLogs = Effect.fn('DeploymentApiService.getLogs')(function* (
      deploymentId: DeploymentId,
      options?: { offset: number; limit: number; 'createdAt[gt]'?: string }
    ) {
      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(`${baseUrl}/deployments/${deploymentId}/logs${objectToQueryString(options)}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }),
        catch: (error) =>
          new DeploymentLogsFetchError({
            message: `Failed to get logs: ${error instanceof Error ? error.message : String(error)}`,
          }),
      });

      if (!response.ok) {
        const body = yield* Effect.tryPromise({
          try: () => response.text(),
          catch: () => new DeploymentLogsFetchError({ message: 'Failed to read logs error' }),
        });
        return yield* Effect.fail(new DeploymentLogsFetchError({ message: `Failed to get logs: ${body}` }));
      }

      const json = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: () => new DeploymentLogsFetchError({ message: 'Failed to parse logs response' }),
      });

      const decoded = yield* Schema.decodeUnknown(DeploymentLogPageResponse)(json).pipe(
        Effect.mapError(() => new DeploymentLogsFetchError({ message: 'Invalid logs response schema' }))
      );

      return decoded as DeploymentLogPage;
    });

    return {
      createDeployment,
      startMultipartUpload,
      getPresignedUrl,
      uploadPart,
      completeUpload,
      getDeploymentStatus,
      getLogs,
    };
  }),
}) {}

import { GigadriveClient } from '@gigadrive/sdk';
import { Config, Effect } from 'effect';
import type { DeploymentId, UploadId } from '../domain';
import {
  DeploymentAuthError,
  DeploymentCreateError,
  DeploymentLogsFetchError,
  DeploymentStatusError,
  PresignedUrlError,
  UploadCompleteError,
  UploadPartError,
  UploadStartError,
} from '../errors';
import { AuthService } from './auth';

// ---------------------------------------------------------------------------
// DeploymentApiService
// ---------------------------------------------------------------------------

const ApiBaseUrl = Config.string('GIGADRIVE_API_BASE_URL').pipe(Config.withDefault('http://localhost:3000'));

export class DeploymentApiService extends Effect.Service<DeploymentApiService>()('DeploymentApiService', {
  accessors: true,

  effect: Effect.gen(function* () {
    const baseUrl = yield* ApiBaseUrl;
    const authService = yield* AuthService;

    const getClient: Effect.Effect<GigadriveClient, DeploymentAuthError> = Effect.gen(function* () {
      const token: string = yield* authService.getAccessToken.pipe(
        Effect.mapError((err) => new DeploymentAuthError({ message: `Authentication failed: ${err.message}` }))
      );
      return new GigadriveClient({ bearerToken: token, baseUrl });
    });

    const createDeployment = Effect.fn('DeploymentApiService.createDeployment')(function* (applicationId: string) {
      yield* Effect.annotateCurrentSpan('applicationId', applicationId);
      yield* Effect.log('Creating deployment', { applicationId });

      const client = yield* getClient;
      const deployment = yield* Effect.tryPromise({
        try: () => client.deployments.create({ applicationId }),
        catch: (error) =>
          new DeploymentCreateError({
            message: `Failed to create deployment: ${error instanceof Error ? error.message : String(error)}`,
          }),
      });

      yield* Effect.log('Deployment created', { deploymentId: deployment.id });
      return deployment.id as DeploymentId;
    });

    const startMultipartUpload = Effect.fn('DeploymentApiService.startMultipartUpload')(function* (
      deploymentId: DeploymentId
    ) {
      yield* Effect.annotateCurrentSpan('deploymentId', deploymentId);

      const client = yield* getClient;
      const result = yield* Effect.tryPromise({
        try: () => client.deployments.startUpload(deploymentId),
        catch: (error) =>
          new UploadStartError({
            message: `Failed to start multipart upload: ${error instanceof Error ? error.message : String(error)}`,
          }),
      });

      return result.uploadId as UploadId;
    });

    const getPresignedUrl = Effect.fn('DeploymentApiService.getPresignedUrl')(function* (
      deploymentId: DeploymentId,
      uploadId: UploadId,
      partNumber: number
    ) {
      const client = yield* getClient;
      const result = yield* Effect.tryPromise({
        try: () => client.deployments.getPresignedUrl(deploymentId, uploadId, partNumber),
        catch: (error) =>
          new PresignedUrlError({
            message: `Failed to get presigned URL: ${error instanceof Error ? error.message : String(error)}`,
            partNumber,
          }),
      });

      return result.url;
    });

    const uploadPart = Effect.fn('DeploymentApiService.uploadPart')(function* (
      presignedUrl: string,
      data: Buffer,
      partNumber: number
    ) {
      yield* Effect.annotateCurrentSpan('partNumber', partNumber);
      yield* Effect.annotateCurrentSpan('size', data.length);

      const client = yield* getClient;
      const result = yield* Effect.tryPromise({
        try: () => client.deployments.uploadPart(presignedUrl, data, partNumber),
        catch: (error) =>
          new UploadPartError({
            message: `Failed to upload part ${partNumber}: ${error instanceof Error ? error.message : String(error)}`,
            partNumber,
          }),
      });

      return result;
    });

    const completeUpload = Effect.fn('DeploymentApiService.completeUpload')(function* (
      deploymentId: DeploymentId,
      uploadId: UploadId,
      parts: Array<{ partNumber: number; etag: string }>
    ) {
      yield* Effect.annotateCurrentSpan('deploymentId', deploymentId);
      yield* Effect.annotateCurrentSpan('partsCount', parts.length);

      const client = yield* getClient;
      yield* Effect.tryPromise({
        try: () => client.deployments.completeUpload(deploymentId, uploadId, parts),
        catch: (error) =>
          new UploadCompleteError({
            message: `Failed to complete upload: ${error instanceof Error ? error.message : String(error)}`,
          }),
      });

      yield* Effect.log('Upload completed successfully');
    });

    const getDeploymentStatus = Effect.fn('DeploymentApiService.getDeploymentStatus')(function* (
      deploymentId: DeploymentId
    ) {
      const client = yield* getClient;
      const deployment = yield* Effect.tryPromise({
        try: () => client.deployments.get(deploymentId),
        catch: (error) =>
          new DeploymentStatusError({
            message: `Failed to get deployment status: ${error instanceof Error ? error.message : String(error)}`,
          }),
      });

      return deployment.status;
    });

    const getLogs = Effect.fn('DeploymentApiService.getLogs')(function* (
      deploymentId: DeploymentId,
      options?: { offset: number; limit: number; 'createdAt[gt]'?: string }
    ) {
      const client = yield* getClient;
      const result = yield* Effect.tryPromise({
        try: () => client.deployments.getLogs(deploymentId, options),
        catch: (error) =>
          new DeploymentLogsFetchError({
            message: `Failed to get logs: ${error instanceof Error ? error.message : String(error)}`,
          }),
      });

      return result;
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

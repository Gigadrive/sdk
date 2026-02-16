import { ConfigProvider, Effect, Layer, Logger, LogLevel } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeploymentId, UploadId } from '../domain';
import { DeploymentApiService } from './deployment-api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = 'https://api.example.com';

const makeTestLayer = () => {
  const configLayer = Layer.setConfigProvider(ConfigProvider.fromMap(new Map([['GIGADRIVE_API_BASE_URL', BASE_URL]])));

  // configLayer must wrap DeploymentApiService.Default so that Config.*
  // values resolved during layer construction see our overrides.
  return Layer.provide(DeploymentApiService.Default, configLayer).pipe(
    Layer.provideMerge(Logger.minimumLogLevel(LogLevel.None))
  );
};

const depId = 'dep-123' as DeploymentId;
const uploadId = 'upload-456' as UploadId;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeploymentApiService', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // -----------------------------------------------------------------------
  // createDeployment
  // -----------------------------------------------------------------------

  describe('createDeployment', () => {
    it('should POST to the correct URL and return the deployment id', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'new-dep-id' }),
      });

      const testLayer = makeTestLayer();
      const result = await Effect.runPromise(Effect.provide(DeploymentApiService.createDeployment('app-1'), testLayer));

      expect(result).toBe('new-dep-id');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/app-1/deployments`,
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should fail with DeploymentCreateError on non-OK response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('server error details'),
      });

      const testLayer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.provide(DeploymentApiService.createDeployment('app-1'), testLayer).pipe(
          Effect.catchTag('DeploymentCreateError', (err) =>
            Effect.succeed({ _tag: 'caught' as const, message: err.message, statusCode: err.statusCode })
          )
        )
      );

      expect(result).toMatchObject({ _tag: 'caught', statusCode: 500 });
    });

    it('should fail with DeploymentCreateError when fetch throws', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const testLayer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.provide(DeploymentApiService.createDeployment('app-1'), testLayer).pipe(
          Effect.catchTag('DeploymentCreateError', (err) =>
            Effect.succeed({ _tag: 'caught' as const, message: err.message })
          )
        )
      );

      expect(result).toMatchObject({ _tag: 'caught' });
      expect((result as { message: string }).message).toContain('Network error');
    });

    it('should fail with DeploymentCreateError when response has invalid schema', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ notId: 'oops' }),
      });

      const testLayer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.provide(DeploymentApiService.createDeployment('app-1'), testLayer).pipe(
          Effect.catchTag('DeploymentCreateError', (err) =>
            Effect.succeed({ _tag: 'caught' as const, message: err.message })
          )
        )
      );

      expect(result).toMatchObject({ _tag: 'caught', message: 'Invalid deployment response schema' });
    });
  });

  // -----------------------------------------------------------------------
  // startMultipartUpload
  // -----------------------------------------------------------------------

  describe('startMultipartUpload', () => {
    it('should GET the correct URL and return the upload id', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ uploadId: 'new-upload-id' }),
      });

      const testLayer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.provide(DeploymentApiService.startMultipartUpload(depId), testLayer)
      );

      expect(result).toBe('new-upload-id');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/deployments/${depId}/pre-signed-url/start`,
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should fail with UploadStartError on non-OK response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve('service unavailable'),
      });

      const testLayer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.provide(DeploymentApiService.startMultipartUpload(depId), testLayer).pipe(
          Effect.catchTag('UploadStartError', (err) =>
            Effect.succeed({ _tag: 'caught' as const, message: err.message })
          )
        )
      );

      expect(result).toMatchObject({ _tag: 'caught' });
    });
  });

  // -----------------------------------------------------------------------
  // getPresignedUrl
  // -----------------------------------------------------------------------

  describe('getPresignedUrl', () => {
    it('should fetch the presigned URL with correct query params', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ url: 'https://s3.example.com/presigned' }),
      });

      const testLayer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.provide(DeploymentApiService.getPresignedUrl(depId, uploadId, 1), testLayer)
      );

      expect(result).toBe('https://s3.example.com/presigned');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/deployments/${depId}/pre-signed-url/part?uploadId=${uploadId}&partNumber=1`,
        expect.anything()
      );
    });

    it('should fail with PresignedUrlError including partNumber on failure', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('not found'),
      });

      const testLayer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.provide(DeploymentApiService.getPresignedUrl(depId, uploadId, 3), testLayer).pipe(
          Effect.catchTag('PresignedUrlError', (err) =>
            Effect.succeed({ _tag: 'caught' as const, partNumber: err.partNumber })
          )
        )
      );

      expect(result).toMatchObject({ _tag: 'caught', partNumber: 3 });
    });
  });

  // -----------------------------------------------------------------------
  // uploadPart
  // -----------------------------------------------------------------------

  describe('uploadPart', () => {
    it('should PUT data and return partNumber + etag', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ ETag: '"abc123"' }),
      });

      const testLayer = makeTestLayer();
      const data = Buffer.from('test data');
      const result = await Effect.runPromise(
        Effect.provide(DeploymentApiService.uploadPart('https://s3.example.com/part', data, 1), testLayer)
      );

      expect(result).toEqual({ partNumber: 1, etag: '"abc123"' });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://s3.example.com/part',
        expect.objectContaining({
          method: 'PUT',
          body: data,
        })
      );
    });

    it('should fail with UploadPartError when response is not OK', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Forbidden',
      });

      const testLayer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.provide(
          DeploymentApiService.uploadPart('https://s3.example.com/part', Buffer.from('data'), 2),
          testLayer
        ).pipe(
          Effect.catchTag('UploadPartError', (err) =>
            Effect.succeed({ _tag: 'caught' as const, partNumber: err.partNumber })
          )
        )
      );

      expect(result).toMatchObject({ _tag: 'caught', partNumber: 2 });
    });

    it('should fail with UploadPartError when no ETag is returned', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({}), // No ETag
      });

      const testLayer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.provide(
          DeploymentApiService.uploadPart('https://s3.example.com/part', Buffer.from('data'), 1),
          testLayer
        ).pipe(
          Effect.catchTag('UploadPartError', (err) => Effect.succeed({ _tag: 'caught' as const, message: err.message }))
        )
      );

      expect(result).toMatchObject({ _tag: 'caught' });
      expect((result as { message: string }).message).toContain('No ETag');
    });
  });

  // -----------------------------------------------------------------------
  // completeUpload
  // -----------------------------------------------------------------------

  describe('completeUpload', () => {
    it('should POST the correct payload', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

      const parts = [
        { partNumber: 1, etag: '"abc"' },
        { partNumber: 2, etag: '"def"' },
      ];

      const testLayer = makeTestLayer();
      await Effect.runPromise(Effect.provide(DeploymentApiService.completeUpload(depId, uploadId, parts), testLayer));

      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/deployments/${depId}/pre-signed-url/complete`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ uploadId, parts }),
        })
      );
    });

    it('should fail with UploadCompleteError on non-OK response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('bad request'),
      });

      const testLayer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.provide(DeploymentApiService.completeUpload(depId, uploadId, []), testLayer).pipe(
          Effect.catchTag('UploadCompleteError', (err) =>
            Effect.succeed({ _tag: 'caught' as const, message: err.message })
          )
        )
      );

      expect(result).toMatchObject({ _tag: 'caught' });
    });
  });

  // -----------------------------------------------------------------------
  // getDeploymentStatus
  // -----------------------------------------------------------------------

  describe('getDeploymentStatus', () => {
    it('should return the deployment status', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'ACTIVE' }),
      });

      const testLayer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.provide(DeploymentApiService.getDeploymentStatus(depId), testLayer)
      );

      expect(result).toBe('ACTIVE');
    });

    it('should fail with DeploymentStatusError on non-OK response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('not found'),
      });

      const testLayer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.provide(DeploymentApiService.getDeploymentStatus(depId), testLayer).pipe(
          Effect.catchTag('DeploymentStatusError', (err) =>
            Effect.succeed({ _tag: 'caught' as const, message: err.message })
          )
        )
      );

      expect(result).toMatchObject({ _tag: 'caught' });
    });

    it('should fail with DeploymentStatusError on invalid status value', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'UNKNOWN_STATUS' }),
      });

      const testLayer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.provide(DeploymentApiService.getDeploymentStatus(depId), testLayer).pipe(
          Effect.catchTag('DeploymentStatusError', (err) =>
            Effect.succeed({ _tag: 'caught' as const, message: err.message })
          )
        )
      );

      expect(result).toMatchObject({ _tag: 'caught', message: 'Invalid deployment status response schema' });
    });
  });

  // -----------------------------------------------------------------------
  // getLogs
  // -----------------------------------------------------------------------

  describe('getLogs', () => {
    it('should return a log page', async () => {
      const logPage = {
        totalItems: 1,
        limit: 10,
        offset: 0,
        items: [{ id: 'log-1', message: 'Build started', type: 'INFO', createdAt: '2025-01-01T00:00:00Z' }],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(logPage),
      });

      const testLayer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.provide(DeploymentApiService.getLogs(depId, { offset: 0, limit: 10 }), testLayer)
      );

      expect(result.totalItems).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].message).toBe('Build started');
    });

    it('should fail with DeploymentLogsFetchError on non-OK response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('forbidden'),
      });

      const testLayer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.provide(DeploymentApiService.getLogs(depId, { offset: 0, limit: 10 }), testLayer).pipe(
          Effect.catchTag('DeploymentLogsFetchError', (err) =>
            Effect.succeed({ _tag: 'caught' as const, message: err.message })
          )
        )
      );

      expect(result).toMatchObject({ _tag: 'caught' });
    });

    it('should fail with DeploymentLogsFetchError on invalid response schema', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: 'schema' }),
      });

      const testLayer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.provide(DeploymentApiService.getLogs(depId, { offset: 0, limit: 10 }), testLayer).pipe(
          Effect.catchTag('DeploymentLogsFetchError', (err) =>
            Effect.succeed({ _tag: 'caught' as const, message: err.message })
          )
        )
      );

      expect(result).toMatchObject({ _tag: 'caught', message: 'Invalid logs response schema' });
    });
  });
});

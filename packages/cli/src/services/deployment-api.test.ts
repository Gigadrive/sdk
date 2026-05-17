import { ConfigProvider, Effect, Layer, Logger, LogLevel } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeploymentId, UploadId } from '../domain';
import { AuthService } from './auth';
import { DeploymentApiService } from './deployment-api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = 'https://api.example.com';

const makeTestLayer = () => {
  const configLayer = Layer.setConfigProvider(ConfigProvider.fromMap(new Map([['GIGADRIVE_API_BASE_URL', BASE_URL]])));

  // Provide a mock AuthService that returns a static test token
  const mockAuthService = Layer.succeed(AuthService, {
    login: Effect.succeed(true as const),
    logout: Effect.void,
    getAccessToken: Effect.succeed('test-auth-token'),
    getUserInfo: Effect.succeed({}),
    refreshAccessToken: Effect.succeed(true as const),
    inferUserName: () => 'test-user',
    _tag: 'AuthService',
  });

  return Layer.provide(DeploymentApiService.Default, Layer.mergeAll(configLayer, mockAuthService)).pipe(
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
    it('should create a deployment and return the id', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'new-dep-id',
            applicationId: 'app-1',
            status: 'PENDING',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          }),
          { status: 200 }
        )
      );

      const testLayer = makeTestLayer();
      const result = await Effect.runPromise(Effect.provide(DeploymentApiService.createDeployment('app-1'), testLayer));

      expect(result).toBe('new-dep-id');
    });

    it('should fail with DeploymentCreateError on non-OK response', async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ error: 'server error' }), { status: 500 }));

      const testLayer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.provide(DeploymentApiService.createDeployment('app-1'), testLayer).pipe(
          Effect.catchTag('DeploymentCreateError', (err) =>
            Effect.succeed({ _tag: 'caught' as const, message: err.message })
          )
        )
      );

      expect(result).toMatchObject({ _tag: 'caught' });
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
  });

  // -----------------------------------------------------------------------
  // startMultipartUpload
  // -----------------------------------------------------------------------

  describe('startMultipartUpload', () => {
    it('should return the upload id', async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ uploadId: 'new-upload-id' }), { status: 200 }));

      const testLayer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.provide(DeploymentApiService.startMultipartUpload(depId), testLayer)
      );

      expect(result).toBe('new-upload-id');
    });

    it('should fail with UploadStartError on non-OK response', async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ error: 'service unavailable' }), { status: 503 }));

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
    it('should return the presigned URL', async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ url: 'https://s3.example.com/presigned' }), { status: 200 }));

      const testLayer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.provide(DeploymentApiService.getPresignedUrl(depId, uploadId, 1), testLayer)
      );

      expect(result).toBe('https://s3.example.com/presigned');
    });

    it('should fail with PresignedUrlError including partNumber on failure', async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ error: 'not found' }), { status: 404 }));

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
      globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200, headers: { ETag: '"abc123"' } }));

      const testLayer = makeTestLayer();
      const data = Buffer.from('test data');
      const result = await Effect.runPromise(
        Effect.provide(DeploymentApiService.uploadPart('https://s3.example.com/part', data, 1), testLayer)
      );

      expect(result).toEqual({ partNumber: 1, etag: '"abc123"' });
    });

    it('should fail with UploadPartError when response is not OK', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response('Forbidden', { status: 403, statusText: 'Forbidden' }));

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
      globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200, headers: {} }));

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
    it('should complete the upload', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));

      const parts = [
        { partNumber: 1, etag: '"abc"' },
        { partNumber: 2, etag: '"def"' },
      ];

      const testLayer = makeTestLayer();
      await Effect.runPromise(Effect.provide(DeploymentApiService.completeUpload(depId, uploadId, parts), testLayer));

      expect(globalThis.fetch).toHaveBeenCalled();
    });

    it('should fail with UploadCompleteError on non-OK response', async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ error: 'bad request' }), { status: 400 }));

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
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: depId,
            applicationId: 'app-1',
            status: 'ACTIVE',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          }),
          { status: 200 }
        )
      );

      const testLayer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.provide(DeploymentApiService.getDeploymentStatus(depId), testLayer)
      );

      expect(result).toBe('ACTIVE');
    });

    it('should fail with DeploymentStatusError on non-OK response', async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ error: 'not found' }), { status: 404 }));

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

      globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(logPage), { status: 200 }));

      const testLayer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.provide(DeploymentApiService.getLogs(depId, { offset: 0, limit: 10 }), testLayer)
      );

      expect(result.totalItems).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].message).toBe('Build started');
    });

    it('should fail with DeploymentLogsFetchError on non-OK response', async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 }));

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
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../http-client';
import type { TusUploadParams } from '../upload/transport';
import { ApplicationStorageResource } from './application-storage';

const HELLO_SHA256 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';

const createUploadResponse = () => ({
  session: { id: 'sess-1', state: 'pending' },
  upload: {
    method: 'PATCH',
    url: 'https://upload.example/abc',
    headers: { 'Tus-Resumable': '1.0.0', 'X-Upload-Token': 'signed-abc' },
    publicObjectUrl: 'https://cdn.example/hello.txt',
  },
});

describe('ApplicationStorageResource.upload', () => {
  it('computes the SHA-256, infers content type, creates a session, and uploads', async () => {
    const http = { post: vi.fn().mockResolvedValue(createUploadResponse()), get: vi.fn() } as unknown as HttpClient;
    const transport = vi.fn<(params: TusUploadParams) => Promise<void>>().mockResolvedValue(undefined);
    const storage = new ApplicationStorageResource(http, transport);

    const result = await storage.upload({
      applicationId: 'app',
      bucketId: 'bucket',
      key: 'hello.txt',
      data: new TextEncoder().encode('hello'),
    });

    expect(http.post).toHaveBeenCalledWith(
      '/applications/app/storage/buckets/bucket/uploads',
      expect.objectContaining({
        key: 'hello.txt',
        contentLength: 5,
        checksumSha256: HELLO_SHA256,
        contentType: 'text/plain',
      })
    );
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][0].uploadUrl).toBe('https://upload.example/abc');
    // Session-provided required headers must reach the transport.
    expect(transport.mock.calls[0][0].headers).toMatchObject({ 'X-Upload-Token': 'signed-abc' });
    expect(result.url).toBe('https://cdn.example/hello.txt');
    expect(result.object).toBeUndefined();
  });

  it('waits for completion and resolves the finalized object', async () => {
    const completedSession = { id: 'sess-1', state: 'completed' };
    const object = { id: 'obj-1', key: 'hello.txt' };
    const get = vi
      .fn()
      .mockResolvedValueOnce(completedSession)
      .mockResolvedValueOnce({ items: [object], total: 1, commonPrefixes: [] });
    const http = { post: vi.fn().mockResolvedValue(createUploadResponse()), get } as unknown as HttpClient;
    const transport = vi.fn<(params: TusUploadParams) => Promise<void>>().mockResolvedValue(undefined);
    const storage = new ApplicationStorageResource(http, transport);

    const result = await storage.upload({
      applicationId: 'app',
      bucketId: 'bucket',
      key: 'hello.txt',
      data: new Uint8Array([1]),
      waitForCompletion: true,
    });

    expect(result.session.state).toBe('completed');
    expect(result.object).toEqual(object);
  });

  it('isolates per-file errors in uploadBatch', async () => {
    const http = { post: vi.fn().mockResolvedValue(createUploadResponse()), get: vi.fn() } as unknown as HttpClient;
    const transport = vi
      .fn<(params: TusUploadParams) => Promise<void>>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('boom'));
    const storage = new ApplicationStorageResource(http, transport);

    const results = await storage.uploadBatch(
      [
        { applicationId: 'a', bucketId: 'b', key: 'k1', data: new Uint8Array([1]) },
        { applicationId: 'a', bucketId: 'b', key: 'k2', data: new Uint8Array([2]) },
      ],
      { concurrency: 1 }
    );

    expect(results[0].result).toBeDefined();
    expect(results[0].error).toBeUndefined();
    expect(results[1].error).toBeDefined();
    expect(results[1].result).toBeUndefined();
  });
});

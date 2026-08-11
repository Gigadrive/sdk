import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../http-client';
import type { TusUploadParams } from '../upload/transport';
import { StorageUploadSessionsResource } from './storage-upload-sessions';

const createMockHttpClient = (): HttpClient =>
  ({
    get: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    post: vi.fn().mockResolvedValue({}),
  }) as unknown as HttpClient;

describe('StorageUploadSessionsResource', () => {
  it('lists sessions by bucket name and environment', async () => {
    const http = createMockHttpClient();
    const resource = new StorageUploadSessionsResource(http, undefined, 'app-1');

    await resource.list('assets', { environment: 'production', perPage: 50 });
    expect(http.get).toHaveBeenCalledWith('/applications/app-1/storage/buckets/assets/uploads', {
      query: { environment: 'production', perPage: 50 },
    });
  });

  it('creates a session with the required checksum and environment', async () => {
    const http = createMockHttpClient();
    const resource = new StorageUploadSessionsResource(http, undefined, 'app-1');
    const data = { key: 'k', contentLength: 3, checksumSha256: 'a'.repeat(64) };

    await resource.create('assets', data, { environment: 'production' });
    expect(http.post).toHaveBeenCalledWith('/applications/app-1/storage/buckets/assets/uploads', data, {
      query: { environment: 'production' },
    });
  });

  it('gets a session while preserving explicit application and UUID fallback', async () => {
    const http = createMockHttpClient();
    const resource = new StorageUploadSessionsResource(http);
    const bucketId = '0197b2f4-5e70-7f3b-9d5c-555555555555';

    await resource.get('app-1', bucketId, 'session-1', { environment: 'preview' });
    expect(http.get).toHaveBeenCalledWith(`/applications/app-1/storage/buckets/${bucketId}/uploads/session-1`, {
      query: { environment: 'preview' },
    });
  });

  it('uploads bytes to a signed URL through the injected transport', async () => {
    const transport = vi.fn<(params: TusUploadParams) => Promise<void>>().mockResolvedValue(undefined);
    const resource = new StorageUploadSessionsResource(createMockHttpClient(), transport);

    await resource.uploadToUrl('https://upload.example/abc', { data: new Uint8Array([1, 2, 3]) });

    expect(transport).toHaveBeenCalledTimes(1);
    const params = transport.mock.calls[0][0];
    expect(params.uploadUrl).toBe('https://upload.example/abc');
    expect(params.uploadSize).toBe(3);
    expect(params.headers).toEqual({ 'Tus-Resumable': '1.0.0' });
  });

  it('resumes through the transport with resume enabled', async () => {
    const transport = vi.fn<(params: TusUploadParams) => Promise<void>>().mockResolvedValue(undefined);
    const resource = new StorageUploadSessionsResource(createMockHttpClient(), transport);

    await resource.resumeFromUrl('https://upload.example/abc', { data: new Uint8Array([1]) });
    expect(transport.mock.calls[0][0].resume).toBe(true);
  });
});

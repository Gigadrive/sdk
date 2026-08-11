import { describe, expect, it, vi } from 'vitest';
import { ConfigurationError } from '../errors';
import type { HttpClient } from '../http-client';
import type { TusUploadParams } from '../upload/transport';
import { ApplicationStorageResource, type UploadFileInput } from './application-storage';

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
  it('uses configured application context and a canonical bucket name', async () => {
    const http = { post: vi.fn().mockResolvedValue(createUploadResponse()), get: vi.fn() } as unknown as HttpClient;
    const transport = vi.fn<(params: TusUploadParams) => Promise<void>>().mockResolvedValue(undefined);
    const storage = new ApplicationStorageResource(http, transport, 'app');

    const result = await storage.upload({
      bucket: 'assets',
      environment: 'production',
      key: 'hello.txt',
      data: new TextEncoder().encode('hello'),
    });

    expect(http.post).toHaveBeenCalledWith(
      '/applications/app/storage/buckets/assets/uploads',
      expect.objectContaining({
        key: 'hello.txt',
        contentLength: 5,
        checksumSha256: HELLO_SHA256,
        contentType: 'text/plain',
      }),
      { query: { environment: 'production' } }
    );
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][0].uploadUrl).toBe('https://upload.example/abc');
    expect(transport.mock.calls[0][0].headers).toMatchObject({ 'X-Upload-Token': 'signed-abc' });
    expect(result.url).toBe('https://cdn.example/hello.txt');
    expect(result.object).toBeUndefined();
  });

  it('preserves environment through completion polling and object lookup', async () => {
    const completedSession = { id: 'sess-1', state: 'completed' };
    const object = { id: 'obj-1', key: 'hello.txt' };
    const get = vi
      .fn()
      .mockResolvedValueOnce(completedSession)
      .mockResolvedValueOnce({ items: [object], total: 1, commonPrefixes: [] });
    const http = { post: vi.fn().mockResolvedValue(createUploadResponse()), get } as unknown as HttpClient;
    const transport = vi.fn<(params: TusUploadParams) => Promise<void>>().mockResolvedValue(undefined);
    const storage = new ApplicationStorageResource(http, transport, 'app');

    const result = await storage.upload({
      bucket: 'assets',
      key: 'hello.txt',
      data: new Uint8Array([1]),
      waitForCompletion: { environment: 'preview' },
    });

    expect(result.session.state).toBe('completed');
    expect(result.object).toEqual(object);
    expect(http.post).toHaveBeenCalledWith('/applications/app/storage/buckets/assets/uploads', expect.any(Object), {
      query: { environment: 'preview' },
    });
    expect(get).toHaveBeenNthCalledWith(1, '/applications/app/storage/buckets/assets/uploads/sess-1', {
      query: { environment: 'preview' },
    });
    expect(get).toHaveBeenNthCalledWith(2, '/applications/app/storage/buckets/assets/objects', {
      query: { environment: 'preview', prefix: 'hello.txt', cursor: undefined },
    });
  });

  it('uses one resolved environment when top-level and completion options differ', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({ id: 'sess-1', state: 'completed' })
      .mockResolvedValueOnce({ items: [], total: 0, commonPrefixes: [] });
    const http = { post: vi.fn().mockResolvedValue(createUploadResponse()), get } as unknown as HttpClient;
    const transport = vi.fn<(params: TusUploadParams) => Promise<void>>().mockResolvedValue(undefined);
    const storage = new ApplicationStorageResource(http, transport, 'app');

    await storage.upload({
      bucket: 'assets',
      environment: 'production',
      key: 'hello.txt',
      data: new Uint8Array([1]),
      waitForCompletion: { environment: 'preview' },
    });

    expect(http.post).toHaveBeenCalledWith('/applications/app/storage/buckets/assets/uploads', expect.any(Object), {
      query: { environment: 'production' },
    });
    expect(get).toHaveBeenNthCalledWith(1, '/applications/app/storage/buckets/assets/uploads/sess-1', {
      query: { environment: 'production' },
    });
    expect(get).toHaveBeenNthCalledWith(2, '/applications/app/storage/buckets/assets/objects', {
      query: { environment: 'production', prefix: 'hello.txt', cursor: undefined },
    });
  });

  it('preserves explicit application and deprecated bucketId upload inputs', async () => {
    const http = { post: vi.fn().mockResolvedValue(createUploadResponse()), get: vi.fn() } as unknown as HttpClient;
    const transport = vi.fn<(params: TusUploadParams) => Promise<void>>().mockResolvedValue(undefined);
    const storage = new ApplicationStorageResource(http, transport, 'default-app');

    await storage.upload({
      applicationId: 'explicit-app',
      bucketId: '0197b2f4-5e70-7f3b-9d5c-555555555555',
      key: 'hello.txt',
      data: new Uint8Array([1]),
    });

    expect(http.post).toHaveBeenCalledWith(
      '/applications/explicit-app/storage/buckets/0197b2f4-5e70-7f3b-9d5c-555555555555/uploads',
      expect.any(Object),
      { query: { environment: undefined } }
    );
  });

  it('fails before hashing or requesting when application context is missing', async () => {
    const http = { post: vi.fn(), get: vi.fn() } as unknown as HttpClient;
    const storage = new ApplicationStorageResource(http, vi.fn());

    await expect(
      storage.upload({ bucket: 'assets', key: 'hello.txt', data: new Uint8Array([1]) })
    ).rejects.toBeInstanceOf(ConfigurationError);
    expect(http.post).not.toHaveBeenCalled();
  });

  it('rejects simultaneous canonical and deprecated bucket fields', async () => {
    const http = { post: vi.fn(), get: vi.fn() } as unknown as HttpClient;
    const storage = new ApplicationStorageResource(http, vi.fn(), 'app');
    const input = {
      bucket: 'assets',
      bucketId: '0197b2f4-5e70-7f3b-9d5c-555555555555',
      key: 'hello.txt',
      data: new Uint8Array([1]),
    } as unknown as UploadFileInput;

    await expect(storage.upload(input)).rejects.toBeInstanceOf(ConfigurationError);
    expect(http.post).not.toHaveBeenCalled();
  });

  it('rejects a missing bucket reference', async () => {
    const http = { post: vi.fn(), get: vi.fn() } as unknown as HttpClient;
    const storage = new ApplicationStorageResource(http, vi.fn(), 'app');
    const input = { key: 'hello.txt', data: new Uint8Array([1]) } as unknown as UploadFileInput;

    await expect(storage.upload(input)).rejects.toBeInstanceOf(ConfigurationError);
    expect(http.post).not.toHaveBeenCalled();
  });

  it('isolates per-file errors in uploadBatch while retaining context', async () => {
    const http = { post: vi.fn().mockResolvedValue(createUploadResponse()), get: vi.fn() } as unknown as HttpClient;
    const transport = vi
      .fn<(params: TusUploadParams) => Promise<void>>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('boom'));
    const storage = new ApplicationStorageResource(http, transport, 'app');

    const results = await storage.uploadBatch(
      [
        { bucket: 'assets', environment: 'production', key: 'k1', data: new Uint8Array([1]) },
        { bucket: 'assets', environment: 'production', key: 'k2', data: new Uint8Array([2]) },
      ],
      { concurrency: 1 }
    );

    expect(results[0].result).toBeDefined();
    expect(results[0].error).toBeUndefined();
    expect(results[1].error).toBeDefined();
    expect(results[1].result).toBeUndefined();
    expect(http.post).toHaveBeenCalledTimes(2);
    expect(http.post).toHaveBeenNthCalledWith(
      2,
      '/applications/app/storage/buckets/assets/uploads',
      expect.any(Object),
      {
        query: { environment: 'production' },
      }
    );
  });
});

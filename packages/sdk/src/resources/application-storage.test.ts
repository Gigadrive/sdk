import { Buffer } from 'node:buffer';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import type { TokenManager } from '../auth/token-manager';
import { ApiError, ConfigurationError, UploadError } from '../errors';
import { HttpClient } from '../http-client';
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
  object: null,
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
    expect(Buffer.isBuffer(transport.mock.calls[0][0].data)).toBe(true);
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

const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

const emptyObject = (key: string) => ({
  id: 'obj-empty',
  bucketId: 'bucket-1',
  applicationId: 'app',
  uploadSessionId: 'sess-empty',
  key,
  contentType: 'text/plain',
  contentLength: 0,
  checksumSha1: null,
  checksumSha256: EMPTY_SHA256,
  checksumMd5: null,
  uploadedAt: '2026-09-24T00:00:00.000Z',
  createdAt: '2026-09-24T00:00:00.000Z',
  updatedAt: '2026-09-24T00:00:00.000Z',
});

const completedEmptyResponse = (key: string) => ({
  session: {
    id: 'sess-empty',
    key,
    contentLength: 0,
    checksumSha256: EMPTY_SHA256,
    state: 'completed',
    uploadedAt: '2026-09-24T00:00:00.000Z',
  },
  upload: null,
  object: emptyObject(key),
});

const bucket = { id: 'bucket-1', name: 'assets', cdnHostname: 'assets.cdn.example' };

/** A mocked HTTP client that answers the create call like the API does for any size. */
const createSizeAwareHttp = () => {
  const post = vi.fn((_path: string, body: { key: string; contentLength: number }) =>
    Promise.resolve(body.contentLength === 0 ? completedEmptyResponse(body.key) : createUploadResponse())
  );
  const get = vi.fn((path: string) => {
    if (path.endsWith('/storage/buckets/assets')) return Promise.resolve(bucket);
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
  return { http: { post, get } as unknown as HttpClient, post, get };
};

describe('ApplicationStorageResource.upload with empty files', () => {
  const inputs: [string, () => Partial<UploadFileInput> | Promise<Partial<UploadFileInput>>][] = [
    ['Buffer', () => ({ data: Buffer.alloc(0) })],
    ['Uint8Array', () => ({ data: new Uint8Array(0) })],
    ['ArrayBuffer', () => ({ data: new ArrayBuffer(0) })],
    ['Blob', () => ({ data: new Blob([]) })],
    ['stream with contentLength 0', () => ({ stream: Readable.from([]), contentLength: 0 })],
    [
      'stream with an explicit empty digest',
      () => ({ stream: Readable.from([]), contentLength: 0, checksumSha256: EMPTY_SHA256 }),
    ],
  ];

  it.each(inputs)('stores an empty %s with one create call and no transfer', async (_name, source) => {
    const { http, post, get } = createSizeAwareHttp();
    const transport = vi.fn<(params: TusUploadParams) => Promise<void>>();
    const onProgress = vi.fn();
    const storage = new ApplicationStorageResource(http, transport, 'app');

    const result = await storage.upload({
      bucket: 'assets',
      environment: 'production',
      key: 'pkg/.gitkeep',
      onProgress,
      ...(await source()),
    } as UploadFileInput);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      '/applications/app/storage/buckets/assets/uploads',
      expect.objectContaining({ key: 'pkg/.gitkeep', contentLength: 0, checksumSha256: EMPTY_SHA256 }),
      { query: { environment: 'production' } }
    );
    // No tus PATCH/HEAD, no session polling, no object lookup: only the bucket read for the URL.
    expect(transport).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/applications/app/storage/buckets/assets', {
      query: { environment: 'production' },
    });
    expect(result.session.state).toBe('completed');
    expect(result.object).toEqual(emptyObject('pkg/.gitkeep'));
    expect(result.url).toBe('https://assets.cdn.example/pkg/.gitkeep');
  });

  it('stores an empty file from a path and closes the read stream it opened', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gigadrive-sdk-empty-'));
    const path = join(dir, '__init__.py');
    writeFileSync(path, '');
    try {
      const { http, post } = createSizeAwareHttp();
      const transport = vi.fn<(params: TusUploadParams) => Promise<void>>();
      const storage = new ApplicationStorageResource(http, transport, 'app');

      const result = await storage.upload({ bucket: 'assets', key: 'src/pkg/__init__.py', path });

      expect(post).toHaveBeenCalledWith(
        '/applications/app/storage/buckets/assets/uploads',
        expect.objectContaining({ contentLength: 0, checksumSha256: EMPTY_SHA256 }),
        { query: { environment: undefined } }
      );
      expect(transport).not.toHaveBeenCalled();
      expect(result.object?.contentLength).toBe(0);
      expect(result.url).toBe('https://assets.cdn.example/src/pkg/__init__.py');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('resolves waitForCompletion without polling the session', async () => {
    const { http, get } = createSizeAwareHttp();
    const transport = vi.fn<(params: TusUploadParams) => Promise<void>>();
    const storage = new ApplicationStorageResource(http, transport, 'app');

    const result = await storage.upload({
      bucket: 'assets',
      key: '.gitkeep',
      data: new Uint8Array(0),
      waitForCompletion: { timeoutMs: 1, pollIntervalMs: 1 },
    });

    expect(result.session.state).toBe('completed');
    expect(result.object?.key).toBe('.gitkeep');
    expect(get).not.toHaveBeenCalledWith(expect.stringContaining('/uploads/'), expect.anything());
    expect(get).not.toHaveBeenCalledWith(expect.stringContaining('/objects'), expect.anything());
    expect(transport).not.toHaveBeenCalled();
  });

  it('builds the URL from the stored key with the same encoding as the API', async () => {
    const { http } = createSizeAwareHttp();
    const storage = new ApplicationStorageResource(http, vi.fn(), 'app');

    const result = await storage.upload({ bucket: 'assets', key: 'docs/empty file#1.txt', data: new Uint8Array(0) });

    expect(result.url).toBe('https://assets.cdn.example/docs/empty%20file%231.txt');
  });

  it('surfaces a 400 from the create call as an ApiError', async () => {
    const fetchFn = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: 'Declared SHA-256 does not match an empty file' }), { status: 400 })
      );
    const tokenManager = { getToken: vi.fn().mockResolvedValue('token'), invalidate: vi.fn() };
    const http = new HttpClient('https://api.example', tokenManager as unknown as TokenManager, fetchFn);
    const transport = vi.fn<(params: TusUploadParams) => Promise<void>>();
    const storage = new ApplicationStorageResource(http, transport, 'app');

    const error = await storage
      .upload({ bucket: 'assets', key: '.gitkeep', data: new Uint8Array(0), checksumSha256: 'a'.repeat(64) })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).message).toBe('Declared SHA-256 does not match an empty file');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(transport).not.toHaveBeenCalled();
  });

  it('fails with an UploadError when a completed session carries no object', async () => {
    const http = {
      post: vi.fn().mockResolvedValue({ ...completedEmptyResponse('.gitkeep'), object: null }),
      get: vi.fn(),
    } as unknown as HttpClient;
    const storage = new ApplicationStorageResource(http, vi.fn(), 'app');

    await expect(storage.upload({ bucket: 'assets', key: '.gitkeep', data: new Uint8Array(0) })).rejects.toBeInstanceOf(
      UploadError
    );
  });

  it('uploads a batch that mixes empty and non-empty files', async () => {
    const { http, post } = createSizeAwareHttp();
    const transport = vi.fn<(params: TusUploadParams) => Promise<void>>().mockResolvedValue(undefined);
    const storage = new ApplicationStorageResource(http, transport, 'app');

    const results = await storage.uploadBatch([
      { bucket: 'assets', key: 'src/.gitkeep', data: new Uint8Array(0) },
      { bucket: 'assets', key: 'src/hello.txt', data: new TextEncoder().encode('hello') },
      { bucket: 'assets', key: 'src/pkg/__init__.py', data: Buffer.alloc(0) },
    ]);

    expect(results.map((r) => r.error)).toEqual([undefined, undefined, undefined]);
    expect(post).toHaveBeenCalledTimes(3);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][0].uploadSize).toBe(5);
    expect(results[0].result?.object?.contentLength).toBe(0);
    expect(results[0].result?.url).toBe('https://assets.cdn.example/src/.gitkeep');
    expect(results[1].result?.url).toBe('https://cdn.example/hello.txt');
    expect(results[1].result?.object).toBeUndefined();
    expect(results[2].result?.object?.key).toBe('src/pkg/__init__.py');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getRuntimeCacheTagState,
  readRuntimeCache,
  resetRuntimeCacheClientForTests,
  revalidateRuntimeCacheTags,
  writeRuntimeCache,
} from './nextjs-runtime-cache-client';

const tokenResponse = (token = 'token-1', expiresIn = 300) =>
  new Response(JSON.stringify({ access_token: token, expires_in: expiresIn }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('nextjs runtime cache client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetRuntimeCacheClientForTests();
    process.env.GIGADRIVE_CLIENT_ID = 'client-id';
    process.env.GIGADRIVE_CLIENT_SECRET = 'client-secret';
    process.env.GIGADRIVE_DEPLOYMENT_ID = 'deployment-1';
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GIGADRIVE_CLIENT_ID;
    delete process.env.GIGADRIVE_CLIENT_SECRET;
    delete process.env.GIGADRIVE_DEPLOYMENT_ID;
  });

  it('authenticates with workload credentials and reuses the cached token', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ value: { hello: 'world' } }))
      .mockResolvedValueOnce(jsonResponse({ value: { second: true } }));

    await expect(readRuntimeCache('incremental', 'key-1')).resolves.toEqual({ hello: 'world' });
    await expect(readRuntimeCache('incremental', 'key-2')).resolves.toEqual({ second: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(tokenUrl).toBe('https://api.gigadrive.network/oauth2/token');
    expect(new Headers(tokenInit.headers).get('authorization')).toBe(
      `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`
    );
    const [entryUrl, entryInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(entryUrl).toBe('https://api.gigadrive.network/internal/runtime-cache/v1/entries/incremental/key-1');
    expect(new Headers(entryInit.headers).get('authorization')).toBe('Bearer token-1');
    expect(new Headers(entryInit.headers).get('x-gigadrive-deployment-id')).toBe('deployment-1');
  });

  it('refreshes the token once when the API rejects it', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse('stale-token'))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(tokenResponse('fresh-token'))
      .mockResolvedValueOnce(jsonResponse({ value: 'ok' }));

    await expect(readRuntimeCache('incremental', 'key')).resolves.toBe('ok');

    const retryInit = fetchMock.mock.calls[3][1] as RequestInit;
    expect(new Headers(retryInit.headers).get('authorization')).toBe('Bearer fresh-token');
  });

  it('retries transient server errors and surfaces persistent write failures', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));

    await expect(writeRuntimeCache('incremental', 'key', { a: 1 })).rejects.toThrow(
      'Gigadrive runtime cache write failed with status 503'
    );
    // One token request plus the initial attempt and two retries.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('round-trips binary values through the base64 envelope', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(jsonResponse({}));
    const bytes = new Uint8Array([1, 2, 3]);

    await writeRuntimeCache('incremental', 'binary', { body: bytes, nested: [{ buffer: bytes.buffer }] }, ['tag-1']);

    const writeInit = fetchMock.mock.calls[1][1] as RequestInit;
    const payload = JSON.parse(String(writeInit.body)) as { value: unknown; tags: string[] };
    expect(payload.tags).toEqual(['tag-1']);
    expect(payload.value).toEqual({
      body: { __gigadriveType: 'bytes', value: Buffer.from(bytes).toString('base64') },
      nested: [{ buffer: { __gigadriveType: 'bytes', value: Buffer.from(bytes).toString('base64') } }],
    });

    fetchMock.mockResolvedValueOnce(jsonResponse({ value: payload.value }));
    const decoded = (await readRuntimeCache('incremental', 'binary')) as {
      body: Buffer;
      nested: [{ buffer: Buffer }];
    };
    expect(Buffer.from(decoded.body)).toEqual(Buffer.from(bytes));
    expect(Buffer.from(decoded.nested[0].buffer)).toEqual(Buffer.from(bytes));
  });

  it('rejects circular cache values instead of hanging', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse());
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    await expect(writeRuntimeCache('incremental', 'circular', circular)).rejects.toThrow(
      'Next.js cache entry contains a circular value'
    );
  });

  it('fails fast when workload credentials are missing', async () => {
    delete process.env.GIGADRIVE_CLIENT_ID;

    await expect(revalidateRuntimeCacheTags('incremental', ['tag'])).rejects.toThrow(
      'Gigadrive workload credentials are unavailable'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('degrades tag-state reads to fresh on transport errors', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(getRuntimeCacheTagState('incremental', ['tag'])).resolves.toEqual({ stale: 0, expired: 0 });
  });
});

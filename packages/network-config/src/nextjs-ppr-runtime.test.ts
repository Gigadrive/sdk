import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeCache = vi.hoisted(() => ({ revalidate: vi.fn(), write: vi.fn() }));

vi.mock('./nextjs-runtime-cache-client', () => ({
  revalidateRuntimeCacheTags: runtimeCache.revalidate,
  writeRuntimeCache: runtimeCache.write,
}));

import { persistPprCacheEntry, revalidateNextPath } from './nextjs-ppr-runtime';

describe('persistPprCacheEntry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('atomically persists a normalized PPR shell and postponed state with Next tags', async () => {
    await persistPprCacheEntry('/products/one?preview=1', {
      cacheControl: { revalidate: 60, expire: 300 },
      value: {
        kind: 'APP_PAGE',
        html: { toUnchunkedString: () => '<html>shell</html>' },
        postponed: 'opaque-postponed-state',
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'x-next-cache-tags': 'products, shared',
          'x-number': 42,
          'set-cookie': ['one=1', 'two=2'],
          ignored: undefined,
        },
        status: 201,
      },
    });

    expect(runtimeCache.write).toHaveBeenCalledWith(
      'incremental',
      'ppr:/products/one?preview=1',
      {
        shell: '<html>shell</html>',
        postponedState: 'opaque-postponed-state',
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'x-next-cache-tags': 'products, shared',
          'x-number': '42',
          'set-cookie': ['one=1', 'two=2'],
        },
        status: 201,
        cacheControl: { revalidate: 60, expire: 300 },
      },
      ['products', 'shared']
    );
  });

  it('accepts an already unchunked HTML string and omits absent optional metadata', async () => {
    await persistPprCacheEntry('nested/path', {
      value: { kind: 'APP_PAGE', html: '<html>complete</html>' },
    });

    expect(runtimeCache.write).toHaveBeenCalledWith(
      'incremental',
      'ppr:/nested/path',
      { shell: '<html>complete</html>', headers: {} },
      []
    );
  });

  it.each([
    { value: null },
    { value: { kind: 'PAGES', html: '<html />' } },
    { value: { kind: 'APP_PAGE', html: null } },
    { value: { kind: 'APP_PAGE', html: {} } },
  ])('ignores non-PPR response cache entries %#', async (entry) => {
    await persistPprCacheEntry('/ignored', entry);
    expect(runtimeCache.write).not.toHaveBeenCalled();
  });
});

describe('revalidateNextPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    delete process.env.GIGADRIVE_APPLICATION_ORIGIN;
  });

  it('purges the canonical path and synchronously invokes Next with its revalidation headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { 'x-nextjs-cache': 'REVALIDATED' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await revalidateNextPath({
      urlPath: '/isr?preview=1',
      hostname: 'example.gigadrive.app',
      headers: { 'x-prerender-revalidate': 'preview-id' },
      opts: {},
    });

    expect(runtimeCache.revalidate).toHaveBeenCalledWith('incremental', ['path:/isr']);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.origin).toBe('https://example.gigadrive.app');
    expect(url.pathname).toBe('/isr');
    expect(url.searchParams.get('preview')).toBe('1');
    expect(url.searchParams.get('__gigadrive_revalidate')).toBeTruthy();
    expect(init.method).toBe('HEAD');
    expect(new Headers(init.headers).get('x-prerender-revalidate')).toBe('preview-id');
    expect(new Headers(init.headers).get('cache-control')).toBe('no-cache');
  });

  it('accepts a missing generated page only when Next requests that behavior', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    await expect(
      revalidateNextPath({
        urlPath: '/not-generated',
        hostname: 'example.gigadrive.app',
        headers: {},
        opts: { unstable_onlyGenerated: true },
      })
    ).resolves.toBeUndefined();
  });

  it.each([
    { status: 404, onlyGenerated: false },
    { status: 307, onlyGenerated: true },
    { status: 500, onlyGenerated: false },
  ])('surfaces an invalid Next response %#', async ({ status, onlyGenerated }) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })));

    await expect(
      revalidateNextPath({
        urlPath: '/isr',
        hostname: 'example.gigadrive.app',
        headers: {},
        opts: { unstable_onlyGenerated: onlyGenerated },
      })
    ).rejects.toThrow(`status ${status}`);
  });

  it('rejects cross-origin and malformed inputs before invoking customer traffic', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      revalidateNextPath({
        urlPath: 'https://attacker.invalid/isr',
        hostname: 'example.gigadrive.app',
        headers: {},
        opts: {},
      })
    ).rejects.toThrow('absolute application path');
    await expect(revalidateNextPath({ urlPath: '/isr', hostname: undefined, headers: {}, opts: {} })).rejects.toThrow(
      'application hostname'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeCache = vi.hoisted(() => ({
  getTagState: vi.fn(),
  read: vi.fn(),
  revalidate: vi.fn(),
  write: vi.fn(),
}));

vi.mock('./nextjs-runtime-cache-client', () => ({
  getRuntimeCacheTagState: runtimeCache.getTagState,
  readRuntimeCache: runtimeCache.read,
  revalidateRuntimeCacheTags: runtimeCache.revalidate,
  writeRuntimeCache: runtimeCache.write,
}));

import GigadriveNextCacheHandler from './nextjs-cache-handler';

describe('GigadriveNextCacheHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    runtimeCache.getTagState.mockResolvedValue({ stale: 0, expired: 0 });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('uses an isolated in-process cache while Next is building', async () => {
    vi.stubEnv('GIGADRIVE_NEXT_BUILD', '1');
    const handler = new GigadriveNextCacheHandler();

    await handler.set('/prerender', { kind: 'APP_PAGE', html: '<html />' }, { tags: ['page:/prerender'] });

    await expect(handler.get('/prerender')).resolves.toMatchObject({
      value: { kind: 'APP_PAGE', html: '<html />' },
      tags: ['page:/prerender'],
    });
    expect(runtimeCache.write).not.toHaveBeenCalled();
    expect(runtimeCache.read).not.toHaveBeenCalled();

    await handler.revalidateTag('page:/prerender');
    await expect(handler.get('/prerender')).resolves.toBeNull();
    expect(runtimeCache.revalidate).not.toHaveBeenCalled();
  });

  it('stores the cache handler envelope required by Next', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_784_670_700_000);
    const handler = new GigadriveNextCacheHandler();

    await handler.set('/isr', { kind: 'APP_PAGE', html: '<html />' }, { tags: ['page:/isr'] });

    expect(runtimeCache.write).toHaveBeenCalledWith(
      'incremental',
      '/isr',
      {
        lastModified: 1_784_670_700_000,
        value: { kind: 'APP_PAGE', html: '<html />' },
        tags: ['page:/isr'],
        cacheControl: undefined,
      },
      ['page:/isr']
    );
  });

  it('returns a valid persisted cache handler envelope', async () => {
    const entry = { lastModified: 1_784_670_700_000, value: { kind: 'APP_PAGE' } };
    runtimeCache.read.mockResolvedValue(entry);

    await expect(new GigadriveNextCacheHandler().get('/isr')).resolves.toEqual(entry);
  });

  it('passes explicit and soft tags to the shared tag service', async () => {
    const entry = {
      lastModified: 1_000,
      value: { kind: 'FETCH', revalidate: 60 },
      tags: ['explicit'],
    };
    runtimeCache.read.mockResolvedValue(entry);

    await expect(
      new GigadriveNextCacheHandler().get('/fetch', { tags: ['request'], softTags: ['implicit'] })
    ).resolves.toEqual(entry);

    expect(runtimeCache.getTagState).toHaveBeenCalledWith('incremental', ['explicit', 'request', 'implicit']);
  });

  it('returns a miss when a relevant tag expired after the entry was written', async () => {
    runtimeCache.read.mockResolvedValue({ lastModified: 1_000, value: { kind: 'FETCH' }, tags: ['post:1'] });
    runtimeCache.getTagState.mockResolvedValue({ stale: 0, expired: 2_000 });

    await expect(new GigadriveNextCacheHandler().get('/fetch')).resolves.toBeNull();
  });

  it('forces Next to treat an entry as stale during its revalidation window', async () => {
    runtimeCache.read.mockResolvedValue({ lastModified: 1_000, value: { kind: 'FETCH' }, tags: ['post:1'] });
    runtimeCache.getTagState.mockResolvedValue({ stale: 2_000, expired: 0 });

    await expect(new GigadriveNextCacheHandler().get('/fetch')).resolves.toEqual({
      lastModified: 1,
      value: { kind: 'FETCH' },
      tags: ['post:1'],
    });
  });

  it('forwards timed tag revalidation profiles', async () => {
    await new GigadriveNextCacheHandler().revalidateTag(['post:1'], { expire: 30 });

    expect(runtimeCache.revalidate).toHaveBeenCalledWith('incremental', ['post:1'], { expire: 30 });
  });

  it('fails open on entries written by the legacy raw-value format', async () => {
    runtimeCache.read.mockResolvedValue({ kind: 'APP_PAGE', html: '<html />' });

    await expect(new GigadriveNextCacheHandler().get('/isr')).resolves.toBeNull();
  });

  // Next never puts tags on the set context for APP_PAGE/APP_ROUTE/PAGES; they
  // only exist inside the value's own headers. Reading them from there is what
  // keeps `revalidateTag` working for pages.
  it('indexes page tags from the value headers, which Next omits from the set context', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_784_670_700_000);
    const value = {
      kind: 'APP_PAGE',
      html: '<html />',
      headers: { 'x-next-cache-tags': '_N_T_/layout,_N_T_/posts, post:1 ' },
    };

    await new GigadriveNextCacheHandler().set('/posts/1', value, {});

    expect(runtimeCache.write).toHaveBeenCalledWith('incremental', '/posts/1', expect.objectContaining({ value }), [
      '_N_T_/layout',
      '_N_T_/posts',
      'post:1',
    ]);
  });

  it('serves the build-time prerender from the bundle when nothing was regenerated', async () => {
    runtimeCache.read.mockResolvedValue(null);
    const onDisk = { lastModified: 500, value: { kind: 'APP_PAGE', html: '<prerendered />' } };
    const fileSystemCache = { get: vi.fn().mockResolvedValue(onDisk) };
    const handler = new GigadriveNextCacheHandler();
    // The real handler builds this from Next's constructor context; injecting it
    // keeps the test off Next's private module layout.
    Object.assign(handler, { buildOutputCache: Promise.resolve(fileSystemCache) });

    await expect(handler.get('/about', { kind: 'APP_PAGE' })).resolves.toEqual(onDisk);
    expect(fileSystemCache.get).toHaveBeenCalledWith('/about', { kind: 'APP_PAGE' });
  });

  it('does not resurrect a build-time prerender whose tag was revalidated', async () => {
    runtimeCache.read.mockResolvedValue(null);
    runtimeCache.getTagState.mockResolvedValue({ stale: 0, expired: 9_000 });
    const handler = new GigadriveNextCacheHandler();
    Object.assign(handler, {
      buildOutputCache: Promise.resolve({
        get: vi.fn().mockResolvedValue({
          lastModified: 500,
          value: { kind: 'APP_PAGE', html: '<stale />', headers: { 'x-next-cache-tags': 'post:1' } },
        }),
      }),
    });

    // Tag state is resolved against the remote index, not Next's in-process tag
    // manifest, which is always empty here and would otherwise serve stale HTML.
    await expect(handler.get('/posts/1')).resolves.toBeNull();
    expect(runtimeCache.getTagState).toHaveBeenCalledWith('incremental', ['post:1']);
  });

  it('falls back to a miss when the bundle has no prerender for the key', async () => {
    runtimeCache.read.mockResolvedValue(null);
    const handler = new GigadriveNextCacheHandler();
    Object.assign(handler, { buildOutputCache: Promise.resolve({ get: vi.fn().mockResolvedValue(null) }) });

    await expect(handler.get('/dynamic')).resolves.toBeNull();
  });
});

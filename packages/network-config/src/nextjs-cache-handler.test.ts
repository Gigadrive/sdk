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
});

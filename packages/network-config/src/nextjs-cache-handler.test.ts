import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeCache = vi.hoisted(() => ({
  read: vi.fn(),
  revalidate: vi.fn(),
  write: vi.fn(),
}));

vi.mock('./nextjs-runtime-cache-client', () => ({
  readRuntimeCache: runtimeCache.read,
  revalidateRuntimeCacheTags: runtimeCache.revalidate,
  writeRuntimeCache: runtimeCache.write,
}));

import GigadriveNextCacheHandler from './nextjs-cache-handler';

describe('GigadriveNextCacheHandler', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

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
      },
      ['page:/isr']
    );
  });

  it('returns a valid persisted cache handler envelope', async () => {
    const entry = { lastModified: 1_784_670_700_000, value: { kind: 'APP_PAGE' } };
    runtimeCache.read.mockResolvedValue(entry);

    await expect(new GigadriveNextCacheHandler().get('/isr')).resolves.toEqual(entry);
  });

  it('fails open on entries written by the legacy raw-value format', async () => {
    runtimeCache.read.mockResolvedValue({ kind: 'APP_PAGE', html: '<html />' });

    await expect(new GigadriveNextCacheHandler().get('/isr')).resolves.toBeNull();
  });
});

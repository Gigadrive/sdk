import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeCache = vi.hoisted(() => ({ write: vi.fn() }));

vi.mock('./nextjs-runtime-cache-client', () => ({
  writeRuntimeCache: runtimeCache.write,
}));

import { persistPprCacheEntry } from './nextjs-ppr-runtime';

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
      'ppr:/products/one',
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

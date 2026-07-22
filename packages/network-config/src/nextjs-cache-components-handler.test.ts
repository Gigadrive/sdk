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

import cacheHandler from './nextjs-cache-components-handler';

const serializedEntry = (overrides: Record<string, unknown> = {}) => ({
  value: new Uint8Array([1, 2, 3]),
  tags: ['explicit'],
  stale: 30,
  timestamp: 1_000,
  expire: 300,
  revalidate: 60,
  ...overrides,
});

const readStream = async (stream: ReadableStream<Uint8Array>): Promise<Uint8Array> => {
  const reader = stream.getReader();
  const chunks: number[] = [];
  while (true) {
    const result = await reader.read();
    if (result.done) return new Uint8Array(chunks);
    chunks.push(...result.value);
  }
};

describe('Gigadrive Next Cache Components handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    runtimeCache.getTagState.mockResolvedValue({ stale: 0, expired: 0 });
  });
  afterEach(() => vi.unstubAllEnvs());

  it('uses an in-process stream cache while Next is building', async () => {
    vi.stubEnv('GIGADRIVE_NEXT_BUILD', '1');
    const entry = {
      ...serializedEntry({ tags: ['build:component'] }),
      value: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([4, 5, 6]));
          controller.close();
        },
      }),
    };

    await cacheHandler.set('build-component-key', Promise.resolve(entry));
    const restored = await cacheHandler.get('build-component-key', []);

    await expect(readStream(restored!.value)).resolves.toEqual(new Uint8Array([4, 5, 6]));
    expect(runtimeCache.write).not.toHaveBeenCalled();
    expect(runtimeCache.read).not.toHaveBeenCalled();

    await cacheHandler.updateTags(['build:component']);
    await expect(cacheHandler.get('build-component-key', [])).resolves.toBeUndefined();
    expect(runtimeCache.revalidate).not.toHaveBeenCalled();
  });

  it('restores persisted streams and validates explicit and soft tags together', async () => {
    runtimeCache.read.mockResolvedValue(serializedEntry());

    const entry = await cacheHandler.get('component-key', ['implicit']);

    expect(runtimeCache.getTagState).toHaveBeenCalledWith('component', ['explicit', 'implicit']);
    expect(entry).toMatchObject({ tags: ['explicit'], timestamp: 1_000, revalidate: 60 });
    await expect(readStream(entry!.value)).resolves.toEqual(new Uint8Array([1, 2, 3]));
  });

  it('returns a miss when a tag expired after the entry was written', async () => {
    runtimeCache.read.mockResolvedValue(serializedEntry());
    runtimeCache.getTagState.mockResolvedValue({ stale: 0, expired: 2_000 });

    await expect(cacheHandler.get('component-key', [])).resolves.toBeUndefined();
  });

  it('fails open when a persisted entry is malformed', async () => {
    runtimeCache.read.mockResolvedValue({ value: new Uint8Array([1]), tags: 'not-an-array' });

    await expect(cacheHandler.get('component-key', [])).resolves.toBeUndefined();
    expect(runtimeCache.getTagState).not.toHaveBeenCalled();
  });

  it('marks entries stale during a timed revalidation window', async () => {
    runtimeCache.read.mockResolvedValue(serializedEntry());
    runtimeCache.getTagState.mockResolvedValue({ stale: 2_000, expired: 0 });

    await expect(cacheHandler.get('component-key', [])).resolves.toMatchObject({ revalidate: -1 });
  });

  it('serializes streamed entries before writing them to shared storage', async () => {
    const entry = {
      ...serializedEntry(),
      value: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2]));
          controller.enqueue(new Uint8Array([3]));
          controller.close();
        },
      }),
    };

    await cacheHandler.set('component-key', Promise.resolve(entry));

    expect(runtimeCache.write).toHaveBeenCalledWith(
      'component',
      'component-key',
      { ...entry, value: new Uint8Array([1, 2, 3]) },
      ['explicit']
    );
  });

  it('uses get-time soft-tag validation and forwards timed tag updates', async () => {
    await expect(cacheHandler.getExpiration(['implicit'])).resolves.toBe(Infinity);
    await cacheHandler.updateTags(['post:1'], { expire: 30 });

    expect(runtimeCache.getTagState).not.toHaveBeenCalled();
    expect(runtimeCache.revalidate).toHaveBeenCalledWith('component', ['post:1'], { expire: 30 });
  });
});

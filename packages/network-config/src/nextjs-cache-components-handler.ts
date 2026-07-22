import {
  getRuntimeCacheTagState,
  readRuntimeCache,
  revalidateRuntimeCacheTags,
  writeRuntimeCache,
} from './nextjs-runtime-cache-client';

interface CacheComponentEntry {
  value: ReadableStream<Uint8Array>;
  tags: string[];
  stale: number;
  timestamp: number;
  expire: number;
  revalidate: number;
}

interface SerializedCacheComponentEntry extends Omit<CacheComponentEntry, 'value'> {
  value: Uint8Array;
}

const isSerializedCacheComponentEntry = (value: unknown): value is SerializedCacheComponentEntry => {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<SerializedCacheComponentEntry>;
  return (
    entry.value instanceof Uint8Array &&
    Array.isArray(entry.tags) &&
    entry.tags.every((tag) => typeof tag === 'string') &&
    typeof entry.stale === 'number' &&
    typeof entry.timestamp === 'number' &&
    typeof entry.expire === 'number' &&
    typeof entry.revalidate === 'number'
  );
};

const pendingWrites = new Map<string, Promise<void>>();

const streamToBytes = async (stream: ReadableStream<Uint8Array>): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = stream.getReader();
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    chunks.push(result.value);
    size += result.value.byteLength;
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

/** Shared Network cache handler for Next.js Cache Components and `use cache`. */
const cacheHandler = {
  async get(cacheKey: string, softTags: string[]): Promise<CacheComponentEntry | undefined> {
    await pendingWrites.get(cacheKey);
    const value = await readRuntimeCache('component', cacheKey);
    if (!isSerializedCacheComponentEntry(value)) return undefined;
    const tagState = await getRuntimeCacheTagState('component', [...new Set([...value.tags, ...softTags])]);
    if (tagState.expired > value.timestamp) return undefined;
    return {
      ...value,
      ...(tagState.stale > value.timestamp ? { revalidate: -1 } : {}),
      value: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(value.value);
          controller.close();
        },
      }),
    };
  },

  async set(cacheKey: string, pendingEntry: Promise<CacheComponentEntry>): Promise<void> {
    const write = (async () => {
      const entry = await pendingEntry;
      const value = await streamToBytes(entry.value);
      await writeRuntimeCache('component', cacheKey, { ...entry, value }, entry.tags);
    })();
    pendingWrites.set(cacheKey, write);
    try {
      await write;
    } finally {
      if (pendingWrites.get(cacheKey) === write) pendingWrites.delete(cacheKey);
    }
  },

  async refreshTags(): Promise<void> {},

  getExpiration(): Promise<number> {
    return Promise.resolve(Infinity);
  },

  updateTags(tags: string[], durations?: { expire?: number }): Promise<void> {
    return revalidateRuntimeCacheTags('component', tags, durations);
  },
};

export default cacheHandler;

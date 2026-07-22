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
const buildEntries = new Map<string, SerializedCacheComponentEntry>();

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
    const value =
      process.env.GIGADRIVE_NEXT_BUILD === '1'
        ? buildEntries.get(cacheKey)
        : await readRuntimeCache('component', cacheKey);
    if (!isSerializedCacheComponentEntry(value)) return undefined;
    const tagState =
      process.env.GIGADRIVE_NEXT_BUILD === '1'
        ? { stale: 0, expired: 0 }
        : await getRuntimeCacheTagState('component', [...new Set([...value.tags, ...softTags])]);
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
      const serializedEntry = { ...entry, value };
      if (process.env.GIGADRIVE_NEXT_BUILD === '1') {
        buildEntries.set(cacheKey, serializedEntry);
      } else {
        await writeRuntimeCache('component', cacheKey, serializedEntry, entry.tags);
      }
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

  async updateTags(tags: string[], durations?: { expire?: number }): Promise<void> {
    if (process.env.GIGADRIVE_NEXT_BUILD === '1') {
      for (const [key, entry] of buildEntries) {
        if (entry.tags.some((tag) => tags.includes(tag))) buildEntries.delete(key);
      }
      return;
    }
    return revalidateRuntimeCacheTags('component', tags, durations);
  },
};

export default cacheHandler;

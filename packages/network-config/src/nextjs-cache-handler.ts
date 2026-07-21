import { readRuntimeCache, revalidateRuntimeCacheTags, writeRuntimeCache } from './nextjs-runtime-cache-client';

interface IncrementalCacheContext {
  tags?: string[];
}

interface IncrementalCacheEntry {
  lastModified: number;
  value: unknown | null;
}

const isIncrementalCacheEntry = (value: unknown): value is IncrementalCacheEntry =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Partial<IncrementalCacheEntry>).lastModified === 'number' &&
  'value' in value;

/** Shared Network cache handler for ISR, server responses, fetches, and image metadata. */
export default class GigadriveNextCacheHandler {
  async get(key: string): Promise<IncrementalCacheEntry | null> {
    const entry = await readRuntimeCache('incremental', key);
    return isIncrementalCacheEntry(entry) ? entry : null;
  }

  async set(key: string, data: unknown, context: IncrementalCacheContext): Promise<void> {
    await writeRuntimeCache('incremental', key, { lastModified: Date.now(), value: data }, context.tags ?? []);
  }

  async revalidateTag(tags: string | string[]): Promise<void> {
    await revalidateRuntimeCacheTags('incremental', Array.isArray(tags) ? tags : [tags]);
  }

  resetRequestCache(): void {}
}

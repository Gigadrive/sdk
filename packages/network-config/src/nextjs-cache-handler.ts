import {
  getRuntimeCacheTagState,
  readRuntimeCache,
  revalidateRuntimeCacheTags,
  writeRuntimeCache,
} from './nextjs-runtime-cache-client';

interface IncrementalCacheContext {
  tags?: string[];
  softTags?: string[];
  cacheControl?: unknown;
}

interface IncrementalCacheEntry {
  lastModified: number;
  value: unknown | null;
  tags?: string[];
  cacheControl?: unknown;
}

const isIncrementalCacheEntry = (value: unknown): value is IncrementalCacheEntry =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Partial<IncrementalCacheEntry>).lastModified === 'number' &&
  'value' in value;

/** Shared Network cache handler for ISR, server responses, fetches, and image metadata. */
export default class GigadriveNextCacheHandler {
  async get(key: string, context: IncrementalCacheContext = {}): Promise<IncrementalCacheEntry | null> {
    const entry = await readRuntimeCache('incremental', key);
    if (!isIncrementalCacheEntry(entry)) return null;
    const tags = [...new Set([...(entry.tags ?? []), ...(context.tags ?? []), ...(context.softTags ?? [])])];
    if (tags.length === 0) return entry;
    const tagState = await getRuntimeCacheTagState('incremental', tags);
    if (tagState.expired > entry.lastModified) return null;
    return tagState.stale > entry.lastModified ? { ...entry, lastModified: 1 } : entry;
  }

  async set(key: string, data: unknown, context: IncrementalCacheContext): Promise<void> {
    const tags = context.tags ?? [];
    await writeRuntimeCache(
      'incremental',
      key,
      { lastModified: Date.now(), value: data, tags, cacheControl: context.cacheControl },
      tags
    );
  }

  async revalidateTag(tags: string | string[], durations?: { expire?: number }): Promise<void> {
    await revalidateRuntimeCacheTags('incremental', Array.isArray(tags) ? tags : [tags], durations);
  }

  resetRequestCache(): void {}
}

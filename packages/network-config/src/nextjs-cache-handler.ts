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
  private readonly buildEntries = new Map<string, IncrementalCacheEntry>();

  async get(key: string, context: IncrementalCacheContext = {}): Promise<IncrementalCacheEntry | null> {
    const entry =
      process.env.GIGADRIVE_NEXT_BUILD === '1'
        ? (this.buildEntries.get(key) ?? null)
        : await readRuntimeCache('incremental', key);
    if (!isIncrementalCacheEntry(entry)) return null;
    const tags = [...new Set([...(entry.tags ?? []), ...(context.tags ?? []), ...(context.softTags ?? [])])];
    if (process.env.GIGADRIVE_NEXT_BUILD === '1' || tags.length === 0) return entry;
    const tagState = await getRuntimeCacheTagState('incremental', tags);
    if (tagState.expired > entry.lastModified) return null;
    return tagState.stale > entry.lastModified ? { ...entry, lastModified: 1 } : entry;
  }

  async set(key: string, data: unknown, context: IncrementalCacheContext): Promise<void> {
    const tags = context.tags ?? [];
    const entry = { lastModified: Date.now(), value: data, tags, cacheControl: context.cacheControl };
    if (process.env.GIGADRIVE_NEXT_BUILD === '1') {
      this.buildEntries.set(key, entry);
      return;
    }
    await writeRuntimeCache('incremental', key, entry, tags);
  }

  async revalidateTag(tags: string | string[], durations?: { expire?: number }): Promise<void> {
    const normalizedTags = Array.isArray(tags) ? tags : [tags];
    if (process.env.GIGADRIVE_NEXT_BUILD === '1') {
      for (const [key, entry] of this.buildEntries) {
        if (entry.tags?.some((tag) => normalizedTags.includes(tag))) this.buildEntries.delete(key);
      }
      return;
    }
    await revalidateRuntimeCacheTags('incremental', normalizedTags, durations);
  }

  resetRequestCache(): void {}
}

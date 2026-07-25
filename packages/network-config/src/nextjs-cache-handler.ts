import {
  getRuntimeCacheTagState,
  readRuntimeCache,
  revalidateRuntimeCacheTags,
  writeRuntimeCache,
} from './nextjs-runtime-cache-client';

/** Header Next uses to carry an entry's cache tags (comma separated). */
const NEXT_CACHE_TAGS_HEADER = 'x-next-cache-tags';

interface IncrementalCacheContext {
  tags?: string[];
  softTags?: string[];
  cacheControl?: unknown;
  kind?: string;
}

interface IncrementalCacheEntry {
  lastModified: number;
  value: unknown | null;
  tags?: string[];
  cacheControl?: unknown;
}

/** Constructor context Next passes to a custom cache handler. */
interface CacheHandlerConstructorContext {
  fs?: unknown;
  serverDistDir?: string;
  dev?: boolean;
  flushToDisk?: boolean;
  revalidatedTags?: string[];
  maxMemoryCacheSize?: number;
  _requestHeaders?: unknown;
  fetchCacheKeyPrefix?: string;
}

interface FileSystemCacheLike {
  get(key: string, context: IncrementalCacheContext): Promise<IncrementalCacheEntry | null | undefined>;
}

const isIncrementalCacheEntry = (value: unknown): value is IncrementalCacheEntry =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Partial<IncrementalCacheEntry>).lastModified === 'number' &&
  'value' in value;

/**
 * Reads the cache tags carried by a cached value's own headers.
 *
 * Next never populates `context.tags` for APP_PAGE/APP_ROUTE/PAGES — only fetch
 * cache entries carry tags on the context. For route entries the tags live in
 * the cached value's headers under `x-next-cache-tags` as a comma-joined string,
 * so reading them here is what keeps the remote tag index (and therefore
 * `revalidateTag`) working for pages and route handlers.
 */
const valueTags = (value: unknown): string[] => {
  const header = (value as { headers?: Record<string, unknown> } | null)?.headers?.[NEXT_CACHE_TAGS_HEADER];
  if (typeof header !== 'string') return [];
  return header
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
};

/** Every tag relevant to an entry: its own, the request's, and the value's headers. */
const collectTags = (
  entryTags: string[] | undefined,
  value: unknown,
  context: IncrementalCacheContext = {}
): string[] => [
  ...new Set([...(entryTags ?? []), ...(context.tags ?? []), ...(context.softTags ?? []), ...valueTags(value)]),
];

const isBuildPhase = (): boolean => process.env.GIGADRIVE_NEXT_BUILD === '1';

/**
 * How long a locally cached entry may serve before the remote copy is re-read.
 * Bounds staleness when another instance rewrites the entry; tag-driven
 * invalidation is unaffected because tag state is checked remotely on every
 * read regardless of where the entry bytes came from.
 */
const LOCAL_ENTRY_TTL_MS = 5 * 60_000;
const LOCAL_CACHE_MAX_ENTRIES = 256;
const LOCAL_CACHE_MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const LOCAL_CACHE_MAX_ENTRY_BYTES = 8 * 1024 * 1024;

interface LocalCacheSlot {
  entry: IncrementalCacheEntry;
  cachedAt: number;
  bytes: number;
}

const approximateEntryBytes = (entry: IncrementalCacheEntry): number => {
  try {
    return JSON.stringify(entry)?.length ?? LOCAL_CACHE_MAX_ENTRY_BYTES + 1;
  } catch {
    // Circular or otherwise unserializable values are never cached locally.
    return LOCAL_CACHE_MAX_ENTRY_BYTES + 1;
  }
};

/**
 * Byte-bounded in-process LRU in front of the remote entry store.
 *
 * The remote store is an HTTP service backed by object storage, so every miss
 * costs a network round trip — and when that store degrades, page renders
 * degrade with it (a production incident showed second-level blob latency
 * turning every render of a cached page into a multi-second response).
 * Serving entry bytes locally removes that dependency from the hot path while
 * the per-read remote tag-state check keeps `revalidateTag` authoritative.
 */
class LocalEntryCache {
  private readonly slots = new Map<string, LocalCacheSlot>();
  private totalBytes = 0;

  get(key: string): IncrementalCacheEntry | undefined {
    const slot = this.slots.get(key);
    if (!slot) return undefined;
    if (Date.now() - slot.cachedAt > LOCAL_ENTRY_TTL_MS) {
      this.delete(key);
      return undefined;
    }
    // Refresh recency for LRU eviction.
    this.slots.delete(key);
    this.slots.set(key, slot);
    return slot.entry;
  }

  set(key: string, entry: IncrementalCacheEntry): void {
    const bytes = approximateEntryBytes(entry);
    if (bytes > LOCAL_CACHE_MAX_ENTRY_BYTES) {
      this.delete(key);
      return;
    }
    this.delete(key);
    this.slots.set(key, { entry, cachedAt: Date.now(), bytes });
    this.totalBytes += bytes;
    while (this.slots.size > LOCAL_CACHE_MAX_ENTRIES || this.totalBytes > LOCAL_CACHE_MAX_TOTAL_BYTES) {
      const oldest = this.slots.keys().next().value;
      if (oldest === undefined) break;
      this.delete(oldest);
    }
  }

  delete(key: string): void {
    const slot = this.slots.get(key);
    if (!slot) return;
    this.slots.delete(key);
    this.totalBytes -= slot.bytes;
  }

  clear(): void {
    this.slots.clear();
    this.totalBytes = 0;
  }
}

const localEntries = new LocalEntryCache();

/** Test-only: the local entry cache is process-wide, so suites must isolate it. */
export const clearLocalEntryCacheForTesting = (): void => localEntries.clear();

/** Shared Network cache handler for ISR, server responses, fetches, and image metadata. */
export default class GigadriveNextCacheHandler {
  private readonly buildEntries = new Map<string, IncrementalCacheEntry>();
  /**
   * Next's own on-disk reader, pointed at the build output that ships inside the
   * deployment bundle (`writeStandaloneDirectory` recursively copies
   * `.next/server/{app,pages}`). Injecting a `cacheHandler` replaces Next's
   * FileSystemCache outright, which would otherwise strand every build-time
   * prerender and force a cold re-render of each page on first request.
   * Delegating to Next's reader keeps us off its private on-disk format.
   */
  private buildOutputCache?: Promise<FileSystemCacheLike | undefined>;
  private readonly context: CacheHandlerConstructorContext;

  constructor(context: CacheHandlerConstructorContext = {}) {
    this.context = context;
  }

  /**
   * Loads Next's on-disk reader lazily, memoized across requests. A Next release
   * that moves or renames the module degrades to "no build-output fallback" —
   * the remote cache still serves everything that has been regenerated.
   */
  private loadBuildOutputCache(): Promise<FileSystemCacheLike | undefined> {
    this.buildOutputCache ??= (async () => {
      if (!this.context.fs || !this.context.serverDistDir) return undefined;
      try {
        const module: unknown = await import('next/dist/server/lib/incremental-cache/file-system-cache.js');
        // Next ships this as CommonJS, so the constructor sits behind a different
        // number of `default` hops depending on whether this bundle was loaded as
        // CJS or ESM. Unwrap until a callable turns up rather than guessing.
        let candidate: unknown = module;
        for (let hop = 0; hop < 3 && candidate && typeof candidate !== 'function'; hop += 1) {
          candidate = (candidate as { default?: unknown }).default;
        }
        if (typeof candidate !== 'function') return undefined;
        const FileSystemCache = candidate as new (context: CacheHandlerConstructorContext) => FileSystemCacheLike;
        return new FileSystemCache(this.context);
      } catch {
        return undefined;
      }
    })();
    return this.buildOutputCache;
  }

  /**
   * Applies remote tag state to an entry.
   *
   * @returns the entry, a stale-marked copy, or `null` when a tag expired.
   */
  private async applyTagState(entry: IncrementalCacheEntry, tags: string[]): Promise<IncrementalCacheEntry | null> {
    if (tags.length === 0) return entry;
    const tagState = await getRuntimeCacheTagState('incremental', tags);
    if (tagState.expired > entry.lastModified) return null;
    return tagState.stale > entry.lastModified ? { ...entry, lastModified: 1 } : entry;
  }

  async get(key: string, context: IncrementalCacheContext = {}): Promise<IncrementalCacheEntry | null> {
    if (isBuildPhase()) {
      const buildEntry = this.buildEntries.get(key) ?? null;
      return isIncrementalCacheEntry(buildEntry) ? buildEntry : null;
    }

    const local = localEntries.get(key);
    if (local) {
      return this.applyTagState(local, collectTags(local.tags, local.value, context));
    }

    const remote = await readRuntimeCache('incremental', key);
    if (isIncrementalCacheEntry(remote)) {
      localEntries.set(key, remote);
      return this.applyTagState(remote, collectTags(remote.tags, remote.value, context));
    }

    // Nothing regenerated yet: fall back to the build-time prerender shipped in
    // the bundle. Tag expiry is still resolved against the remote index — Next's
    // reader only knows its own in-process tag manifest, which is always empty
    // here, so trusting it would resurrect content after a `revalidateTag`.
    const buildOutputCache = await this.loadBuildOutputCache();
    const fromDisk = await buildOutputCache?.get(key, context).catch(() => null);
    if (!isIncrementalCacheEntry(fromDisk)) return null;
    return this.applyTagState(fromDisk, collectTags(fromDisk.tags, fromDisk.value, context));
  }

  async set(key: string, data: unknown, context: IncrementalCacheContext): Promise<void> {
    const tags = collectTags(undefined, data, context);
    const entry = { lastModified: Date.now(), value: data, tags, cacheControl: context.cacheControl };
    if (isBuildPhase()) {
      this.buildEntries.set(key, entry);
      return;
    }
    localEntries.set(key, entry);
    try {
      await writeRuntimeCache('incremental', key, entry, tags);
    } catch (error) {
      // The local copy would outlive a failed durable write and mask it from
      // this instance for the whole TTL; drop it so reads retry remotely.
      localEntries.delete(key);
      throw error;
    }
  }

  async revalidateTag(tags: string | string[], durations?: { expire?: number }): Promise<void> {
    const normalizedTags = Array.isArray(tags) ? tags : [tags];
    if (isBuildPhase()) {
      for (const [key, entry] of this.buildEntries) {
        if (entry.tags?.some((tag) => normalizedTags.includes(tag))) this.buildEntries.delete(key);
      }
      return;
    }
    await revalidateRuntimeCacheTags('incremental', normalizedTags, durations);
  }

  resetRequestCache(): void {}
}

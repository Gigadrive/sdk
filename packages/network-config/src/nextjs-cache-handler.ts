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

    const remote = await readRuntimeCache('incremental', key);
    if (isIncrementalCacheEntry(remote)) {
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
    await writeRuntimeCache('incremental', key, entry, tags);
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

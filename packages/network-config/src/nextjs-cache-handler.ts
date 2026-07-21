import { readRuntimeCache, revalidateRuntimeCacheTags, writeRuntimeCache } from './nextjs-runtime-cache-client';

interface IncrementalCacheContext {
  tags?: string[];
}

/** Shared Network cache handler for ISR, server responses, fetches, and image metadata. */
export default class GigadriveNextCacheHandler {
  async get(key: string): Promise<unknown | null> {
    return (await readRuntimeCache('incremental', key)) ?? null;
  }

  async set(key: string, data: unknown, context: IncrementalCacheContext): Promise<void> {
    await writeRuntimeCache('incremental', key, data, context.tags ?? []);
  }

  async revalidateTag(tags: string | string[]): Promise<void> {
    await revalidateRuntimeCacheTags('incremental', Array.isArray(tags) ? tags : [tags]);
  }

  resetRequestCache(): void {}
}

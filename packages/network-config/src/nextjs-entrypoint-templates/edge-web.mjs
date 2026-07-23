// Template for the generated Edge runtime wrapper, which speaks the Web
// `fetch(Request) -> Response` contract expected by the edge gateway. The
// quoted `__GIGADRIVE_*__` tokens are replaced with JSON-encoded values and
// the `__GIGADRIVE_EDGE_IMPORTS__` marker line is replaced with the ordered
// chunk imports by `writeEntrypointWrappers` in nextjs-adapter.ts. Keep the
// fetch export in sync with node-middleware-web.mjs (asserted by
// nextjs-adapter.test.ts).
import { persistPprCacheEntry } from '__GIGADRIVE_PPR_RUNTIME__';
import { AsyncLocalStorage } from 'node:async_hooks';

globalThis.self ??= globalThis;
globalThis.AsyncLocalStorage ??= AsyncLocalStorage;
/* __GIGADRIVE_EDGE_IMPORTS__ */
const registry = globalThis._ENTRIES;
if (!registry) throw new Error('Next.js edge entry registry is unavailable');
const entry = await registry['__GIGADRIVE_EDGE_ENTRY_KEY__'];
const nextHandler = entry?.['__GIGADRIVE_EDGE_HANDLER_EXPORT__'];
if (typeof nextHandler !== 'function') throw new Error('Next.js edge handler is unavailable');

export async function fetch(request) {
  const pending = [];
  const url = new URL(request.url);
  const response = await nextHandler(request, {
    signal: request.signal,
    waitUntil(promise) {
      pending.push(Promise.resolve(promise));
    },
    requestMeta: {
      hostname: url.hostname,
      invocationTarget: request.headers.get('x-gigadrive-next-invocation-target') ?? url.pathname,
      routeMatches: Object.fromEntries(new URLSearchParams(request.headers.get('x-now-route-matches') ?? '')),
      relativeProjectDir: '__GIGADRIVE_RELATIVE_PROJECT_DIR__',
      onCacheEntryV2(cacheEntry, meta) {
        pending.push(
          persistPprCacheEntry(
            request.headers.get('x-gigadrive-next-cache-key') ??
              meta.url ??
              request.headers.get('x-matched-path') ??
              url.pathname,
            cacheEntry
          )
        );
        return false;
      },
    },
  });
  if (!response.body) {
    await Promise.allSettled(pending);
    return response;
  }
  const reader = response.body.getReader();
  const body = new ReadableStream({
    async pull(controller) {
      const result = await reader.read();
      if (result.done) {
        await Promise.allSettled(pending);
        controller.close();
        return;
      }
      controller.enqueue(result.value);
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        await Promise.allSettled(pending);
      }
    },
  });
  return new Response(body, response);
}

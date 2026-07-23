// Template for the generated Node middleware wrapper, which speaks the Web
// `fetch(Request) -> Response` contract expected by the edge gateway. The
// quoted `__GIGADRIVE_*__` tokens are replaced with JSON-encoded values by
// `writeEntrypointWrappers` in nextjs-adapter.ts. Keep the handler resolution
// block in sync with node-route.mjs and the fetch export in sync with
// edge-web.mjs (both are asserted by nextjs-adapter.test.ts).
import { persistPprCacheEntry } from '__GIGADRIVE_PPR_RUNTIME__';
import { fileURLToPath } from 'node:url';

// The Next server resolves configured cache handlers and build manifests
// relative to the process working directory, so monorepo deployments must run
// from the project directory rather than the repository root. The chdir runs
// exactly once at module evaluation — never per request — so concurrent
// invocations cannot race on process-global state.
process.chdir(fileURLToPath(new URL('__GIGADRIVE_PROJECT_DIR__', import.meta.url)));

const nextEntrypoint = await import('__GIGADRIVE_ENTRYPOINT__');
// Turbopack builds may export the module (or its default) as a promise.
const loadedEntrypoint = await Promise.resolve(nextEntrypoint.default ?? nextEntrypoint);
const nextHandler =
  nextEntrypoint.handler ??
  loadedEntrypoint?.handler ??
  loadedEntrypoint?.default?.handler ??
  loadedEntrypoint?.default ??
  loadedEntrypoint;
if (typeof nextHandler !== 'function') throw new Error('Next.js middleware handler is unavailable');

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

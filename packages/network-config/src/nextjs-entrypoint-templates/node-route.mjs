// Template for the generated Node route-handler wrapper. The quoted
// `__GIGADRIVE_*__` tokens are replaced with JSON-encoded values by
// `writeEntrypointWrappers` in nextjs-adapter.ts before the file is written
// into `.gigadrive/nextjs/entrypoints/`. Keep the request contract in sync
// with node-middleware-web.mjs (the handler resolution block is asserted to
// stay identical by nextjs-adapter.test.ts).
import { persistPprCacheEntry, revalidateNextPath } from '__GIGADRIVE_PPR_RUNTIME__';
import 'next/dist/build/adapter/setup-node-env.external.js';
import { fileURLToPath } from 'node:url';

// The Next server resolves configured cache handlers and build manifests
// relative to the process working directory, so monorepo deployments must run
// from the project directory rather than the repository root. The chdir runs
// exactly once at module evaluation — never per request — so concurrent
// invocations cannot race on process-global state.
process.chdir(fileURLToPath(new URL('__GIGADRIVE_PROJECT_DIR__', import.meta.url)));

// The Next entrypoint must be imported lazily on the first request, not with a
// top-level await: some route module graphs block on facilities that only
// exist once the guest server is listening, and eager evaluation deadlocks the
// boot (observed as MicroVM boot loops in prod). The promise is shared, so the
// module still evaluates exactly once.
let handlerPromise;
const resolveHandler = () =>
  (handlerPromise ??= (async () => {
    const nextEntrypoint = await import('__GIGADRIVE_ENTRYPOINT__');
    // Turbopack builds may export the module (or its default) as a promise.
    const loadedEntrypoint = await Promise.resolve(nextEntrypoint.default ?? nextEntrypoint);
    const handler =
      nextEntrypoint.handler ??
      loadedEntrypoint?.handler ??
      loadedEntrypoint?.default?.handler ??
      loadedEntrypoint?.default ??
      loadedEntrypoint;
    if (typeof handler !== 'function') throw new Error('Next.js Node handler is unavailable');
    return handler;
  })());

export default async function handler(req, res) {
  const nextHandler = await resolveHandler();
  const pending = [];
  const hostname = Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host;
  await nextHandler(req, res, {
    waitUntil(promise) {
      pending.push(Promise.resolve(promise));
    },
    requestMeta: {
      hostname,
      invocationTarget: req.headers['x-gigadrive-next-invocation-target'] ?? req.url,
      routeMatches: Object.fromEntries(new URLSearchParams(req.headers['x-now-route-matches'] ?? '')),
      relativeProjectDir: '__GIGADRIVE_RELATIVE_PROJECT_DIR__',
      revalidate(input) {
        return revalidateNextPath({ ...input, hostname });
      },
      onCacheEntryV2(cacheEntry, meta) {
        const cacheKey = req.headers['x-gigadrive-next-cache-key'];
        const matchedPath = req.headers['x-matched-path'];
        pending.push(
          persistPprCacheEntry(
            (Array.isArray(cacheKey) ? cacheKey[0] : cacheKey) ??
              meta.url ??
              (Array.isArray(matchedPath) ? matchedPath[0] : matchedPath) ??
              req.url ??
              '/',
            cacheEntry
          )
        );
        return false;
      },
    },
  });
  await Promise.allSettled(pending);
}

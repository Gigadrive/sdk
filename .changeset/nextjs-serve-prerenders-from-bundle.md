---
'@gigadrive/network-config': minor
---

Next.js: serve build-time prerenders from the deployment bundle and stop uploading them as assets.

Injecting a `cacheHandler` replaces Next's `FileSystemCache` outright, which stranded every build-time
prerender: pages were re-rendered on first request even though `writeStandaloneDirectory` already copies
the full `.next/server/{app,pages}` output into the standalone bundle. To compensate, the deploy uploaded
one HTML shell per prerendered output — over 10,000 objects, asset rows, and gateway outputs for a large
content site — that nothing ever read.

The cache handler now falls back to Next's own on-disk reader for the build output shipped inside the
bundle, so prerendered pages serve immediately with no extra uploads and no platform state. Tag expiry for
those entries is still resolved against the remote runtime cache, so a `revalidateTag` is never resurrected
by the on-disk copy.

Also fixes two latent bugs in the cache path:

- **Page cache tags were never indexed.** Next does not populate `context.tags` for `APP_PAGE`/`APP_ROUTE`/
  `PAGES` — the tags live in the cached value's `x-next-cache-tags` header. Tags are now read from there, so
  the remote tag index (and therefore `revalidateTag` and CDN purging) works for pages and route handlers.
- **RSC segment data was silently discarded.** Next stores `segmentData` as a `Map`, which serialized to
  `{}`, losing every prefetched segment on the next read. Maps now round-trip through the cache transport.

Deployments additionally export a bounded `entryPagePaths` sample for CDN warming instead of the full
prerender table. Requires the matching Network release to consume it.

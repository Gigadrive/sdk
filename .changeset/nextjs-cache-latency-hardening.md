---
'@gigadrive/network-config': minor
---

Next.js: serve cache entry bytes from an in-process store and keep image URLs stable across deploys.

A production incident showed the remote runtime-cache blob store degrading to multi-second reads, which
turned every render of a *cached* page into a 4-6 second response — the cache was slower than recomputing.
Entry bytes are now served from a byte-bounded in-process cache (5-minute TTL, 64 MB cap) while tag state
is still checked remotely on every read, so `revalidateTag` stays authoritative and cross-instance
invalidation is unaffected. A failed durable write drops the local copy so it cannot mask the failure.

The image loader now strips Next's `?dpl=<deploymentId>` marker from local sources. The optimizer resolves
the deployment from the request hostname and never reads `dpl`, so the per-deploy URL only invalidated the
CDN's entire image cache on every release — forcing a full re-optimization burst (and transiently broken
images) after each deploy.

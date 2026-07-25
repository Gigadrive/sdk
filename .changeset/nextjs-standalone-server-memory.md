---
'@gigadrive/network-config': minor
---

Next.js: size the single standalone server at 1 GB instead of the 256 MB per-route default.

The previous default sized a serverless function that served one route with a small module graph. A
standalone server instead holds the whole application's graph and renders its heaviest pages, and Node
derives its old-space heap from the container limit — so 256 MB left server rendering thrashing the
garbage collector on large documents rather than merely constrained.

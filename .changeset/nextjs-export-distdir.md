---
'@gigadrive/network-config': minor
---

Publish a Next.js static export from a custom `distDir`. Next writes `output: 'export'` to that directory instead of `out`, so a deployment published only the stale or missing `out` folder. The adapter now records the export directory in `.gigadrive/nextjs.json`.

Serve standalone builds of Next.js 15.3 and older, which cannot load the build adapter. Detection now finds the standalone server without an adapter manifest and publishes `.next/static` and `public` next to it, as it does for Next.js 15.4 and 15.5.

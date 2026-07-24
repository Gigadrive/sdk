---
'@gigadrive/network-config': major
---

Next.js: deploy modern apps (Next >= 16.2) as a single standalone server instead of one serverless function per route.

The adapter now sets `output: 'standalone'` while still injecting the durable cache handlers and custom image loader, so the whole deployment runs as one function per deployment while ISR, PPR, `use cache`/cacheComponents, and image optimization keep working through the platform's runtime-cache and edge image services. `.next/static` is registered as a single `/_next/static` prefix (via the new `NormalizedConfig.assets.prefixes`) rather than enumerating every hashed chunk, which collapses the per-file asset explosion.

Breaking changes:

- The per-route `adapter-v2` build path is removed. The manifest `mode` is now `standalone-v2` (or `export`); `mode: 'adapter-v2'` manifests are rejected.
- The `@gigadrive/network-config/nextjs-ppr-runtime` entry point and the `nextjs-entrypoint-templates` are removed (per-route wrappers are no longer generated).
- Removed manifest types `GigadriveNextRouteOutput`, `GigadriveNextEntrypoint`, `GigadriveNextEdgeRuntime`, `GigadriveNextStaticOutput`, and `GigadriveNextRuntime`. `GigadriveNextBuildManifestV2` is now a union of the standalone and export variants, and `NormalizedNextjsFramework` no longer carries per-route `entrypoints`/`outputs`.

Requires the matching Network platform changes to consume the single-server manifest and serve `/_next/static` as a prefix.

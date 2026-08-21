---
'@gigadrive/network-config': patch
---

fix(network-config): stop the regenerated Next.js 16.3 standalone server trace from including dev-only build toolchain dependencies

When a Next.js 16.3 Turbopack build omits `next-server.js.nft.json` (it skips the aggregate server traces whenever an adapter is configured), the adapter regenerates it with Next's `collectBuildTraces`. That fallback only carries the webpack-era ignore list, so it followed dev-only require edges (`router-server` → `setup-dev-bundler` → hot reloaders) into the application's build toolchain (webpack, terser, esbuild, swc, babel plugins), roughly quadrupling the standalone output. The adapter now merges the same dev-only ignore globs Turbopack's native server tracer uses into `outputFileTracingExcludes['next-server']`, producing a native-equivalent minimal trace while preserving genuine runtime dependencies.

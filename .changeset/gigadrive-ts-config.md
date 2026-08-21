---
'@gigadrive/network-config': minor
'gigadrive': minor
---

Add optional type-safe `gigadrive.ts` config file support (plus `gigadrive.mts`/`.cts`/`.js`/`.mjs`/`.cjs` variants) and `gigadrive.json` discovery. A module config takes precedence over YAML/JSON when both exist; existing YAML/JSON configs continue to work unchanged. The new `defineConfig` helper is available from the dependency-free `@gigadrive/network-config/define-config` subpath (also re-exported from the package root).

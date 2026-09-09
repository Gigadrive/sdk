---
'@gigadrive/network-config': minor
---

Publish a detected framework's `assetsDir` as real static assets.

Framework auto-detection only ever used `assetsDir` to compute the asset path
prefix, so nothing enumerated the directory: every zero-config deployment
resolved to zero static assets. Vite projects, which have no server entrypoint,
failed outright with "does not resolve to any functions, assets or routes", and
Astro, SvelteKit, Remix, Nuxt, Laravel and Symfony deployed their server
function with none of its CSS, JS, fonts or images.

`generateConfig` now walks `assetsDir` after the customer build and publishes
what it finds. When a framework resolves its own asset sources (Next.js, or any
prefix- or manifest-backed collection), those are still used untouched.

Static-only output (no entrypoint and no routes) additionally serves directory
index files at their extensionless path, so a prerendered
`dist/about/index.html` answers `/about` the way static hosts serve it.

`generateConfig` takes the project folder as its third argument and now
requires a `FileSystem` layer.

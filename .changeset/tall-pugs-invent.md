---
'@gigadrive/network-config': major
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

Two directories are deliberately not enumerated. A PHP framework's `public/`
document root skips `.php`, `.phtml` and `.phar`, because an exact-path asset
route outranks the front controller's wildcard and would serve the script's
source instead of running it. The Next.js fallback default (a standalone build
with no Gigadrive build manifest) no longer declares `assetsDir` at all, since
`.next/static` answers `/_next/static/...` and only the manifest-driven configs
map those URLs.

BREAKING: `generateConfig` is publicly exported, and it takes the project folder
as a new third argument and now requires a `FileSystem`/`Path` layer, so its
effect no longer runs on its own. Backward compatibility is not available even
with an optional argument, because the layer requirement changes the effect's
type either way. `detectFramework`, its only in-tree caller, already provides
both.

---
'@gigadrive/network-config': patch
---

Fix Next.js 15 builds and static export URLs.

- Next.js 15 loads the build adapter with an older contract: `modifyConfig(config)` without a context and `onBuildComplete({ routes, outputs })` without the project or config. The adapter destructured the missing context, so every Next.js 15 build failed with "Cannot destructure property 'phase' of 'undefined'". Next.js 15 builds now get standalone output and the legacy manifest, rebuilt from the config Next.js loaded.
- A static export built with `trailingSlash: false`, the default, writes `about.html`. Pages are now published at `/about`, the URL Next.js links to, instead of `/about.html`.

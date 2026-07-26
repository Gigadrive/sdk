---
'@gigadrive/network-config': patch
---

Bypass the image optimizer for SVG sources in the injected Next.js loader.

Next's own `get-img-props` marks `.svg` sources `unoptimized` before any loader runs, but that bypass only applies to the default loader — configuring a custom `loaderFile`, which this adapter injects, skips it. Every `<Image src="*.svg">` was therefore routed through `/_gigadrive/image/`, costing a format-negotiation redirect and an optimizer request for bytes no backend can rasterize anyway.

The loader now returns SVG sources unchanged, matching Next's behavior and the existing handling of oversized source URLs.

One behavioral note for apps that set `dangerouslyAllowSVG: true`: a remote SVG is now fetched by the browser directly from its origin instead of being proxied through the app host. That is what Next's `unoptimized` path does, and it keeps third-party SVG off the app's own origin.

---
'@gigadrive/network-config': patch
---

Decide Pages Router revalidation success from the platform-owned `x-gigadrive-cache` header (falling back to Next's `x-nextjs-cache`) instead of CDN-vendor header names, guard the image loader against oversized optimizer URLs, and add runtime cache client test coverage.

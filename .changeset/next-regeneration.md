---
'@gigadrive/network-config': patch
---

Regenerate Next.js prerenders that ship with a zeroed file timestamp, and record each prerender's runtime cache key in the build manifest so a regenerated page can be found by its Next.js key.

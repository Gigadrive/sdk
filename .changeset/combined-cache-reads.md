---
'@gigadrive/network-config': patch
---

Read a `use cache` entry and the state of its tags in one request. A cache hit in a deployed Next.js app now makes one round trip to the runtime cache instead of two, and falls back to the separate tag lookup when the API answers the entry alone.

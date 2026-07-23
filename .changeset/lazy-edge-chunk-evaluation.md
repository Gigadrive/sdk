---
'@gigadrive/network-config': patch
---

Evaluate Next.js edge chunks lazily on the first request instead of at wrapper module scope; eager top-level evaluation kept MicroVM guests from reaching their listening state and boot-looped edge-runtime functions.

---
'@gigadrive/network-config': patch
---

Add explicit response streaming configuration for Node functions and Vercel Build Output functions. Node functions now stream by default and can opt out with `streaming: false`; Vercel Build Output functions can opt out with `supportsResponseStreaming: false`.

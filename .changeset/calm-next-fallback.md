---
'@gigadrive/network-config': patch
---

Fall back to portable standalone output for Next.js adapter releases before 16.2, whose build adapter context does not expose the version and routing metadata required by adapter-v2.

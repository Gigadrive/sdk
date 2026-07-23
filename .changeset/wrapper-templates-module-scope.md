---
'@gigadrive/network-config': patch
---

Generate Next.js entrypoint wrappers from real template files instead of inline string literals, resolve handlers once at module scope (fixing a per-request `process.chdir` race), and support projects located at the repository root.

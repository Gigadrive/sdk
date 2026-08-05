---
'@gigadrive/network-config': patch
---

Resolve the entrypoint for Express, Fastify, Hono, and Elysia projects from `package.json` (`main` field, then a `node <file>` start script, then common file locations on disk) instead of always using the preset's hardcoded path. Route destinations follow the resolved entrypoint.

---
'@gigadrive/network-config': major
'gigadrive': minor
---

Add framework auto-detection for zero-config deployments and migrate config parsing to Effect services.

**Framework auto-detection:** Projects using supported frameworks (Next.js, Nuxt, Remix, SvelteKit, Astro, Vite, Hono, Elysia, Express, Fastify, NestJS, Laravel, Symfony) can now be deployed without a `gigadrive.yaml` — the CLI detects the framework from project dependencies and generates appropriate build commands, entrypoints, routes, and runtime settings. When a config file is present alongside a detected framework, user settings take precedence while framework defaults fill gaps.

**Effect-based config pipeline:** The config parsing internals (`RawConfigReader`, `SchemaValidator`, `V4ConfigParser`, `VercelBuildOutputParser`) are now Effect services using `@effect/platform` FileSystem, replacing direct `node:fs` calls and the `mock-fs` test dependency with injectable, testable layers.

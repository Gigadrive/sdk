# @gigadrive/network-config

## 3.4.1

### Patch Changes

- Accept traced directory assets emitted by the Next.js 16 build adapter while retaining repository-boundary validation. ([#349](https://github.com/Gigadrive/sdk/pull/349))

## 3.4.0

### Minor Changes

- Add the Next.js 16 deployment-adapter v2 manifest, split function plans, shared artifacts, runtime cache handlers, framework-neutral managed image policies, image URL helpers, image cache inspection and purge SDK methods, and Next-compatible child-process environment typing. ([#345](https://github.com/Gigadrive/sdk/pull/345))

### Patch Changes

- Updated dependencies [[`7778b12`](https://github.com/Gigadrive/sdk/commit/7778b12937dc3ee2046e632e4d11c78cf502db90)]:
  - @gigadrive/build-utils@1.0.3

## 3.3.2

### Patch Changes

- Preserve Vercel Build Output function directories when mapping files into deployment archives. ([#341](https://github.com/Gigadrive/sdk/pull/341))

## 3.3.1

### Patch Changes

- Use Vercel Build Output v3 as the authoritative Nuxt function layout instead of retaining the incompatible Nitro node-server default entrypoint. ([#339](https://github.com/Gigadrive/sdk/pull/339))

## 3.3.0

### Minor Changes

- Add the Gigadrive Next.js build adapter and zero-config standalone/static asset packaging metadata. ([#328](https://github.com/Gigadrive/sdk/pull/328))

## 3.2.0

### Minor Changes

- Allow function invocations to run for up to eight hours and clarify that `max_duration` applies uniformly to HTTP requests, response streams, and WebSocket connections. ([#324](https://github.com/Gigadrive/sdk/pull/324))

## 3.1.2

### Patch Changes

- Updated dependencies [[`5cd4a03`](https://github.com/Gigadrive/sdk/commit/5cd4a033ecd5d682ca3789c9c8eeb92fb727d086)]:
  - @gigadrive/build-utils@1.0.2

## 3.1.1

### Patch Changes

- Add explicit response streaming configuration for Node functions and Vercel Build Output functions. Node and Bun functions now stream by default and can opt out with `streaming: false`; Vercel Build Output functions can opt out with `supportsResponseStreaming: false`. ([#300](https://github.com/Gigadrive/sdk/pull/300))

## 3.1.0

### Minor Changes

- Add package include/exclude metadata to normalized function entrypoints, refine NestJS output path detection from `nest-cli.json`, and use Composer for detected PHP frameworks even when JavaScript lockfiles are present. ([#298](https://github.com/Gigadrive/sdk/pull/298))

## 3.0.1

### Patch Changes

- Move misplaced dependencies: effect and @effect/platform to peerDependencies in network-config, storybook packages to devDependencies in harmony ([#272](https://github.com/Gigadrive/sdk/pull/272))

## 3.0.0

### Major Changes

- Add framework auto-detection for zero-config deployments and migrate config parsing to Effect services. ([#268](https://github.com/Gigadrive/sdk/pull/268))

  **Framework auto-detection:** Projects using supported frameworks (Next.js, Nuxt, Remix, SvelteKit, Astro, Vite, Hono, Elysia, Express, Fastify, NestJS, Laravel, Symfony) can now be deployed without a `gigadrive.yaml` — the CLI detects the framework from project dependencies and generates appropriate build commands, entrypoints, routes, and runtime settings. When a config file is present alongside a detected framework, user settings take precedence while framework defaults fill gaps.

  **Effect-based config pipeline:** The config parsing internals (`RawConfigReader`, `SchemaValidator`, `V4ConfigParser`, `VercelBuildOutputParser`) are now Effect services using `@effect/platform` FileSystem, replacing direct `node:fs` calls and the `mock-fs` test dependency with injectable, testable layers.

## 2.1.2

### Patch Changes

- update dependencies ([#232](https://github.com/Gigadrive/sdk/pull/232))

- Updated dependencies [[`0a55d51`](https://github.com/Gigadrive/sdk/commit/0a55d51d3e7ac003b1524b0781c0e8849105f24a)]:
  - @gigadrive/build-utils@1.0.1
  - @gigadrive/commons@2.1.1

## 2.1.1

### Patch Changes

- fix functions being defined as assets ([#58](https://github.com/Gigadrive/sdk/pull/58))

## 2.1.0

### Minor Changes

- fix vercel-related issues and restructure some of the code ([#46](https://github.com/Gigadrive/sdk/pull/46))

### Patch Changes

- Updated dependencies [[`9e06f36`](https://github.com/Gigadrive/sdk/commit/9e06f3638a51c01c72050f8f9c12eb51c3851966)]:
  - @gigadrive/commons@2.1.0

## 2.0.4

### Patch Changes

- fix invalid version check on Vercel Build Output API v3 files ([#34](https://github.com/Gigadrive/sdk/pull/34))

## 2.0.3

### Patch Changes

- remove dirname function ([#32](https://github.com/Gigadrive/sdk/pull/32))

## 2.0.2

### Patch Changes

- added new commons functions, fixed schema and CLI issues ([#28](https://github.com/Gigadrive/sdk/pull/28))

## 2.0.1

### Patch Changes

- fix index barrel file ([`75c09ee`](https://github.com/Gigadrive/sdk/commit/75c09ee52836b7798b5235f215924661735ef7f2))

## 2.0.0

### Major Changes

- fixed exports and typings ([#19](https://github.com/Gigadrive/sdk/pull/19))

### Patch Changes

- Updated dependencies [[`04703f1`](https://github.com/Gigadrive/sdk/commit/04703f1a9a3adb76994b25c08b840f8cbde4cb84)]:
  - @gigadrive/build-utils@1.0.0

## 1.1.0

### Minor Changes

- add typings ([#10](https://github.com/Gigadrive/sdk/pull/10))

### Patch Changes

- Updated dependencies [[`45f65ed`](https://github.com/Gigadrive/sdk/commit/45f65ed1e6428a248c71c792a17c7c9b6eeb8c39)]:
  - @gigadrive/build-utils@0.1.0

## 1.0.0

### Major Changes

- add config v4 ([#8](https://github.com/Gigadrive/sdk/pull/8))

# @gigadrive/network-config

## 3.4.12

### Patch Changes

- Keep Next.js 16.2 prerender and Cache Component writes local to the build process, and default zero-config split deployments to one region. ([#384](https://github.com/Gigadrive/sdk/pull/384))

## 3.4.11

### Patch Changes

- Fall back to portable standalone output for Next.js adapter releases before 16.2, whose build adapter context does not expose the version and routing metadata required by adapter-v2. ([#382](https://github.com/Gigadrive/sdk/pull/382))

## 3.4.10

### Patch Changes

- Support synchronous Pages Router path revalidation in split Next.js 16 functions. ([#379](https://github.com/Gigadrive/sdk/pull/379))

## 3.4.9

### Patch Changes

- Persist Next.js PPR shell and postponed-state updates through the managed runtime cache. ([#370](https://github.com/Gigadrive/sdk/pull/370))

## 3.4.8

### Patch Changes

- Emit an image filename extension that Bunny Optimizer recognizes for extensionless and dynamic Next.js image sources. ([#366](https://github.com/Gigadrive/sdk/pull/366))

- Persist the incremental-cache envelope required by Next.js so ISR entries can be read after regeneration. ([#368](https://github.com/Gigadrive/sdk/pull/368))

## 3.4.7

### Patch Changes

- Import Next.js Edge executables from their canonical packaged module paths. ([#363](https://github.com/Gigadrive/sdk/pull/363))

## 3.4.6

### Patch Changes

- Package Next.js Edge runtime assets at their adapter-defined target paths and publish `public/` files for split Next.js deployments. ([#361](https://github.com/Gigadrive/sdk/pull/361))

## 3.4.5

### Patch Changes

- Initialize Next's Node environment for App Router pages and evaluate canonical Turbopack Edge manifests and chunks before invoking Edge entrypoints. ([#359](https://github.com/Gigadrive/sdk/pull/359))

## 3.4.4

### Patch Changes

- Invoke Next.js Node middleware through its Web Request and Response contract so middleware can complete without hanging the deployment gateway. ([#357](https://github.com/Gigadrive/sdk/pull/357))

## 3.4.3

### Patch Changes

- Include configured Next.js cache handlers, Cache Component handlers, and image loaders in every split function overlay. ([#355](https://github.com/Gigadrive/sdk/pull/355))

## 3.4.2

### Patch Changes

- Emit compact mapped-file overlays for Next.js adapter-v2 functions while preserving pnpm dependency symlinks. ([#351](https://github.com/Gigadrive/sdk/pull/351))

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

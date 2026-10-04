# @gigadrive/network-config

## 5.1.0

### Minor Changes

- `gigadrive.yaml` now accepts a top-level `containers` map for running Docker images on Gigadrive Network. ([#545](https://github.com/Gigadrive/sdk/pull/545))

  Each entry runs one image, from a registry (`image: redis:7-alpine`) or built from a Dockerfile in the repository (`build: .`, or `build: { context, dockerfile, target, args }`). Optional settings are `port`, `entrypoint`, `command`, `env`, `working_dir`, `user` and `memory`.

  - A container without `sidecar: true` runs as a function. Routes target it with `destination: container:<name>`. It also takes `max_duration`, `streaming` and `schedule`. A project that is nothing but one container function gets a catch-all route.
  - A container with `sidecar: true` runs next to every function instance, inside the same microVM, and answers at `<name>:<port>`. That makes it the place for an adjacent Redis or a search engine. A deployment may declare at most four sidecars, and a sidecar may not use a port the function's runtime binds.

  A new top-level `compose` key imports the services of a Compose file as containers. The service marked `x-gigadrive: { public: true }` becomes the function, or else the only service that builds from source; when that is ambiguous, the config is rejected until one is marked. Every other service becomes a sidecar. Entries under `containers` win over imported services of the same name.

  `detectContainerProject()` recognizes a project with a Compose file that declares an app, or failing that a root `Dockerfile`, and returns a deployable configuration. The CLI tries it only when a project has neither a `gigadrive.yaml` nor a detected framework, so a framework project that keeps a Compose file for local databases deploys exactly as before. The CLI also keeps `Dockerfile`, `Dockerfile.*`, `*.Dockerfile` and Compose files in the upload, and leaves `.dockerignore` to the image build when a deployment builds images, which matches what `docker build` sends.

  Exported additions:

  - `NormalizedConfig.sidecars`
  - `NormalizedConfigEntrypoint.container`
  - `NormalizedContainerSpec`, `NormalizedSidecar` and `NormalizedContainerImageSource`
  - `CONTAINER_RUNTIME`, `CONTAINER_ENTRYPOINT_PREFIX` and related constants
  - `ContainerConfigError`
  - `normalizeContainers`, `readComposeContainers`, `splitCommandWords` and `containerEntrypointPath`
  - `detectContainerProject`

  **Type change:** `NormalizedConfigEntrypoint.runtime` is now `Runtime | 'docker'`. Configs that declare no containers produce exactly the same output as before. Code that passes an entrypoint's runtime into a function typed `Runtime` must first handle the `docker` case. Such an entrypoint carries a `container` spec instead of a file path.

- A Dockerfile can be a function like any other: list it under `functions` with `runtime: docker` (for example `functions: { Dockerfile: { runtime: docker, port: 3000 } }`) and route to it by its path. The build context is the Dockerfile's directory, and a pattern such as `services/*/Dockerfile` makes one function per Dockerfile. `port` is accepted only with `runtime: docker`. ([#545](https://github.com/Gigadrive/sdk/pull/545))

  Container functions declared next to a detected framework now join the framework's app instead of replacing it, and routes to them take precedence over the framework's routes. Container names start with a letter, because a name such as `1234` resolves as an IP address before `/etc/hosts`.

- Add Network Queues. ([#544](https://github.com/Gigadrive/sdk/pull/544))

  `@gigadrive/sdk` gains a typed queue client. `queue<T>(name)` returns a handle that works with no configuration inside a
  deployment:

  - `send(payload, { delay, at, groupKey, deduplicationKey, deploymentId, headers })` and `sendBatch()` for immediate,
    delayed and scheduled sends (up to a year ahead), ordering groups and deduplication. `cancel(messageId)` deletes a
    message that has not been processed.
  - `handler(fn)` builds a push consumer (`(request: Request) => Promise<Response>`, such as a Next.js route handler).
    It verifies the delivery signature with `GIGADRIVE_QUEUE_SIGNING_SECRET`. Throw `RetryLaterError('5m')` to defer a
    message without spending an attempt, or `NonRetryableError` to dead-letter it.
  - `receive()` and `consume()` for pull queues, with `ack`, `retry`, `defer`, `deadLetter` and `extendLease` on each
    message. `consume()` acknowledges messages that finish together in one batch request
    (`client.queues.ackBatch()`, up to 100 messages, one billed operation per started ten acknowledged messages),
    retrying a batch that failed in transit or with a 5xx or 429.
  - `ensure()`, `pause()`, `resume()`, `purge()`, `redrive()`, `schedule()` and `unschedule()` for management and cron
    schedules.

  `client.queues` exposes the same API over REST, and `createWorkflowQueue()` implements the Workflow SDK World `Queue`
  interface on top of it, pinning every message to the deployment that sent it. `verifyQueueSignature()` and `signQueueDelivery()` are exported for custom servers and tests.
  `ApiError.code` now also reads a top-level `code` next to a string `error`.

  `@gigadrive/network-config` accepts `services.queues` in `gigadrive.yaml`: queues keyed by name with an optional
  `consumer` path, delivery and retry settings (durations such as `10m` or seconds), concurrency, rate limits and cron
  `schedules`. They normalize to a `queues` service with durations in seconds and schedule bodies as strings.

## 5.0.0

### Major Changes

- Publish a detected framework's `assetsDir` as real static assets. ([#501](https://github.com/Gigadrive/sdk/pull/501))

  Framework auto-detection only ever used `assetsDir` to compute the asset path
  prefix, so nothing enumerated the directory: every zero-config deployment
  resolved to zero static assets. Vite projects, which have no server entrypoint,
  failed outright with "does not resolve to any functions, assets or routes", and
  Astro, SvelteKit, Remix, Nuxt, Laravel and Symfony deployed their server
  function with none of its CSS, JS, fonts or images.

  `generateConfig` now walks `assetsDir` after the customer build and publishes
  what it finds. When a framework resolves its own asset sources (Next.js, or any
  prefix- or manifest-backed collection), those are still used untouched.

  Static-only output (no entrypoint and no routes) additionally serves directory
  index files at their extensionless path, so a prerendered
  `dist/about/index.html` answers `/about` the way static hosts serve it.

  Two directories are deliberately not enumerated. A PHP framework's `public/`
  document root skips `.php`, `.phtml` and `.phar`, because an exact-path asset
  route outranks the front controller's wildcard and would serve the script's
  source instead of running it. The Next.js fallback default (a standalone build
  with no Gigadrive build manifest) no longer declares `assetsDir` at all, since
  `.next/static` answers `/_next/static/...` and only the manifest-driven configs
  map those URLs.

  BREAKING: `generateConfig` is publicly exported, and it takes the project folder
  as a new third argument and now requires a `FileSystem`/`Path` layer, so its
  effect no longer runs on its own. Backward compatibility is not available even
  with an optional argument, because the layer requirement changes the effect's
  type either way. `detectFramework`, its only in-tree caller, already provides
  both.

## 4.6.1

### Patch Changes

- Export mutable Next.js prerender build seeds with complete classification metadata and explicit GET/HEAD scope, plus middleware matcher discovery. ([#473](https://github.com/Gigadrive/sdk/pull/473))

## 4.6.0

### Minor Changes

- Add optional type-safe `gigadrive.ts` config file support (plus `gigadrive.mts`/`.cts`/`.js`/`.mjs`/`.cjs` variants) and `gigadrive.json` discovery. A module config takes precedence over YAML/JSON when both exist; existing YAML/JSON configs continue to work unchanged. The new `defineConfig` helper is available from the dependency-free `@gigadrive/network-config/define-config` subpath (also re-exported from the package root). ([#470](https://github.com/Gigadrive/sdk/pull/470))

### Patch Changes

- fix(network-config): stop the regenerated Next.js 16.3 standalone server trace from including dev-only build toolchain dependencies ([#472](https://github.com/Gigadrive/sdk/pull/472))

  When a Next.js 16.3 Turbopack build omits `next-server.js.nft.json` (it skips the aggregate server traces whenever an adapter is configured), the adapter regenerates it with Next's `collectBuildTraces`. That fallback only carries the webpack-era ignore list, so it followed dev-only require edges (`router-server` → `setup-dev-bundler` → hot reloaders) into the application's build toolchain (webpack, terser, esbuild, swc, babel plugins), roughly quadrupling the standalone output. The adapter now merges the same dev-only ignore globs Turbopack's native server tracer uses into `outputFileTracingExcludes['next-server']`, producing a native-equivalent minimal trace while preserving genuine runtime dependencies.

## 4.5.0

### Minor Changes

- Add portable, manifest-backed static asset collections and emit Next.js static and prerender outputs as compact build sidecars. ([#468](https://github.com/Gigadrive/sdk/pull/468))

## 4.4.0

### Minor Changes

- Add environment-scoped bucket-name addressing, zero-configuration `client.storage` workload context, environment selectors, and the complete object trash lifecycle while retaining deprecated application and bucket UUID compatibility overloads. Add declarative `services.storage.buckets` configuration and normalized provisioning output for File Storage IaC. ([#449](https://github.com/Gigadrive/sdk/pull/449))

## 4.3.7

### Patch Changes

- Resolve the entrypoint for Express, Fastify, Hono, and Elysia projects from `package.json` (`main` field, then a `node <file>` start script, then common file locations on disk) instead of always using the preset's hardcoded path. Route destinations follow the resolved entrypoint. ([#438](https://github.com/Gigadrive/sdk/pull/438))

## 4.3.6

### Patch Changes

- Regenerate the aggregate server traces Next 16.3 stopped emitting in adapter builds. ([#436](https://github.com/Gigadrive/sdk/pull/436))

  Next 16.3 no longer writes `.next/next-server.js.nft.json` (and
  `next-minimal-server.js.nft.json`) from Turbopack builds when an adapter is
  configured, but `next build` still runs its `output: 'standalone'` writer after
  `onBuildComplete` — and that writer reads exactly this file, killing the build
  with `ENOENT` even though compilation succeeded. The managed runtime always
  builds standalone, so every Next 16.3 deployment failed at this step.

  `onBuildComplete` now checks for the aggregate trace and, when missing,
  regenerates both files with Next's own `collectBuildTraces` before the
  standalone writer needs them. Next 16.2 and webpack builds still emit the file
  themselves and skip the regeneration entirely.

## 4.3.5

### Patch Changes

- Avoid inspecting Node.js signal APIs when the Next.js runtime cache client is evaluated inside Edge Runtime. ([#424](https://github.com/Gigadrive/sdk/pull/424))

## 4.3.4

### Patch Changes

- Keep the Node-only resume signal listener out of Edge route bundles when a Gigadrive deployment ID is present during Next.js production builds. ([#420](https://github.com/Gigadrive/sdk/pull/420))

## 4.3.3

### Patch Changes

- Keep the runtime cache client compatible with Next.js Edge route builds while retaining Node microVM resume rewarming. ([#416](https://github.com/Gigadrive/sdk/pull/416))

## 4.3.2

### Patch Changes

- Bypass the image optimizer for SVG sources in the injected Next.js loader. ([#405](https://github.com/Gigadrive/sdk/pull/405))

  Next's own `get-img-props` marks `.svg` sources `unoptimized` before any loader runs, but that bypass only applies to the default loader — configuring a custom `loaderFile`, which this adapter injects, skips it. Every `<Image src="*.svg">` was therefore routed through `/_gigadrive/image/`, costing a format-negotiation redirect and an optimizer request for bytes no backend can rasterize anyway.

  The loader now returns SVG sources unchanged, matching Next's behavior and the existing handling of oversized source URLs.

  One behavioral note for apps that set `dangerouslyAllowSVG: true`: a remote SVG is now fetched by the browser directly from its origin instead of being proxied through the app host. That is what Next's `unoptimized` path does, and it keeps third-party SVG off the app's own origin.

## 4.3.1

### Patch Changes

- The Next.js runtime cache client now re-establishes its connection and refreshes its workload token when the microVM resumes from a suspend snapshot (SIGUSR2), so the first request after a wake no longer serializes behind reconnection. ([`ddbd1f9`](https://github.com/Gigadrive/sdk/commit/ddbd1f9570856a962137e789dc59ab0eeb30f678))

## 4.3.0

### Minor Changes

- Next.js: serve cache entry bytes from an in-process store and keep image URLs stable across deploys. ([`3344f62`](https://github.com/Gigadrive/sdk/commit/3344f62cb228b4288b222bf18ad2f5a079f6511c))

  A production incident showed the remote runtime-cache blob store degrading to multi-second reads, which
  turned every render of a _cached_ page into a 4-6 second response — the cache was slower than recomputing.
  Entry bytes are now served from a byte-bounded in-process cache (5-minute TTL, 64 MB cap) while tag state
  is still checked remotely on every read, so `revalidateTag` stays authoritative and cross-instance
  invalidation is unaffected. A failed durable write drops the local copy so it cannot mask the failure.

  The image loader now strips Next's `?dpl=<deploymentId>` marker from local sources. The optimizer resolves
  the deployment from the request hostname and never reads `dpl`, so the per-deploy URL only invalidated the
  CDN's entire image cache on every release — forcing a full re-optimization burst (and transiently broken
  images) after each deploy.

## 4.2.0

### Minor Changes

- Next.js: size the single standalone server at 1 GB instead of the 256 MB per-route default. ([`861844d`](https://github.com/Gigadrive/sdk/commit/861844dac583a36ffe3e0141af8e408913a16aec))

  The previous default sized a serverless function that served one route with a small module graph. A
  standalone server instead holds the whole application's graph and renders its heaviest pages, and Node
  derives its old-space heap from the container limit — so 256 MB left server rendering thrashing the
  garbage collector on large documents rather than merely constrained.

## 4.1.0

### Minor Changes

- Next.js: serve build-time prerenders from the deployment bundle and stop uploading them as assets. ([`5257ede`](https://github.com/Gigadrive/sdk/commit/5257edeb6b808e9bf440c4ed7e07d72dc122cf12))

  Injecting a `cacheHandler` replaces Next's `FileSystemCache` outright, which stranded every build-time
  prerender: pages were re-rendered on first request even though `writeStandaloneDirectory` already copies
  the full `.next/server/{app,pages}` output into the standalone bundle. To compensate, the deploy uploaded
  one HTML shell per prerendered output — over 10,000 objects, asset rows, and gateway outputs for a large
  content site — that nothing ever read.

  The cache handler now falls back to Next's own on-disk reader for the build output shipped inside the
  bundle, so prerendered pages serve immediately with no extra uploads and no platform state. Tag expiry for
  those entries is still resolved against the remote runtime cache, so a `revalidateTag` is never resurrected
  by the on-disk copy.

  Also fixes two latent bugs in the cache path:

  - **Page cache tags were never indexed.** Next does not populate `context.tags` for `APP_PAGE`/`APP_ROUTE`/
    `PAGES` — the tags live in the cached value's `x-next-cache-tags` header. Tags are now read from there, so
    the remote tag index (and therefore `revalidateTag` and CDN purging) works for pages and route handlers.
  - **RSC segment data was silently discarded.** Next stores `segmentData` as a `Map`, which serialized to
    `{}`, losing every prefetched segment on the next read. Maps now round-trip through the cache transport.

  Deployments additionally export a bounded `entryPagePaths` sample for CDN warming instead of the full
  prerender table. Requires the matching Network release to consume it.

## 4.0.0

### Major Changes

- Next.js: deploy modern apps (Next >= 16.2) as a single standalone server instead of one serverless function per route. ([#400](https://github.com/Gigadrive/sdk/pull/400))

  The adapter now sets `output: 'standalone'` while still injecting the durable cache handlers and custom image loader, so the whole deployment runs as one function per deployment while ISR, PPR, `use cache`/cacheComponents, and image optimization keep working through the platform's runtime-cache and edge image services. `.next/static` is registered as a single `/_next/static` prefix (via the new `NormalizedConfig.assets.prefixes`) rather than enumerating every hashed chunk, which collapses the per-file asset explosion.

  Breaking changes:

  - The per-route `adapter-v2` build path is removed. The manifest `mode` is now `standalone-v2` (or `export`); `mode: 'adapter-v2'` manifests are rejected.
  - The `@gigadrive/network-config/nextjs-ppr-runtime` entry point and the `nextjs-entrypoint-templates` are removed (per-route wrappers are no longer generated).
  - Removed manifest types `GigadriveNextRouteOutput`, `GigadriveNextEntrypoint`, `GigadriveNextEdgeRuntime`, `GigadriveNextStaticOutput`, and `GigadriveNextRuntime`. `GigadriveNextBuildManifestV2` is now a union of the standalone and export variants, and `NormalizedNextjsFramework` no longer carries per-route `entrypoints`/`outputs`.

  Requires the matching Network platform changes to consume the single-server manifest and serve `/_next/static` as a prefix.

### Patch Changes

- Updated dependencies [[`0978f20`](https://github.com/Gigadrive/sdk/commit/0978f206c352414e07f1fda7e09d36b8cdfc8bc0)]:
  - @gigadrive/commons@2.2.0

## 3.4.17

### Patch Changes

- Import Node route and middleware entrypoints lazily on the first request; eager top-level evaluation deadlocked MicroVM guests whose route module graphs block before the server is listening. ([#396](https://github.com/Gigadrive/sdk/pull/396))

## 3.4.16

### Patch Changes

- Evaluate Next.js edge chunks lazily on the first request instead of at wrapper module scope; eager top-level evaluation kept MicroVM guests from reaching their listening state and boot-looped edge-runtime functions. ([#394](https://github.com/Gigadrive/sdk/pull/394))

## 3.4.15

### Patch Changes

- Decide Pages Router revalidation success from the platform-owned `x-gigadrive-cache` header (falling back to Next's `x-nextjs-cache`) instead of CDN-vendor header names, guard the image loader against oversized optimizer URLs, and add runtime cache client test coverage. ([#392](https://github.com/Gigadrive/sdk/pull/392))

- Generate Next.js entrypoint wrappers from real template files instead of inline string literals, resolve handlers once at module scope (fixing a per-request `process.chdir` race), and support projects located at the repository root. ([#392](https://github.com/Gigadrive/sdk/pull/392))

## 3.4.14

### Patch Changes

- Run Next.js Node entrypoints from their project directory so monorepo deployments resolve platform cache handlers and server manifests correctly. ([#388](https://github.com/Gigadrive/sdk/pull/388))

## 3.4.13

### Patch Changes

- Await asynchronous Turbopack Node entrypoint exports before resolving Next.js 16.2 route and middleware handlers. ([#386](https://github.com/Gigadrive/sdk/pull/386))

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

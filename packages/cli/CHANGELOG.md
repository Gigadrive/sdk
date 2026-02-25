# gigadrive

## 2.1.1

### Patch Changes

- Updated dependencies [[`f2dd03b`](https://github.com/Gigadrive/sdk/commit/f2dd03bd48b282c9be3d26e380647671cf0d4a5a)]:
  - @gigadrive/network-config@3.0.1

## 2.1.0

### Minor Changes

- refactor: move architecture from Commander to Effect ([#266](https://github.com/Gigadrive/sdk/pull/266))

- Add framework auto-detection for zero-config deployments and migrate config parsing to Effect services. ([#268](https://github.com/Gigadrive/sdk/pull/268))

  **Framework auto-detection:** Projects using supported frameworks (Next.js, Nuxt, Remix, SvelteKit, Astro, Vite, Hono, Elysia, Express, Fastify, NestJS, Laravel, Symfony) can now be deployed without a `gigadrive.yaml` — the CLI detects the framework from project dependencies and generates appropriate build commands, entrypoints, routes, and runtime settings. When a config file is present alongside a detected framework, user settings take precedence while framework defaults fill gaps.

  **Effect-based config pipeline:** The config parsing internals (`RawConfigReader`, `SchemaValidator`, `V4ConfigParser`, `VercelBuildOutputParser`) are now Effect services using `@effect/platform` FileSystem, replacing direct `node:fs` calls and the `mock-fs` test dependency with injectable, testable layers.

### Patch Changes

- Updated dependencies [[`7a69f89`](https://github.com/Gigadrive/sdk/commit/7a69f89288ea4f2a0247ff75fae2a158e9f2bfe4)]:
  - @gigadrive/network-config@3.0.0

## 2.0.0

### Major Changes

- - add CLI login with `gigadrive login` command, as well as `gigadrive whoami` to show the currently authenticated user information ([#182](https://github.com/Gigadrive/sdk/pull/182))

## 1.1.2

### Patch Changes

- update dependencies ([#232](https://github.com/Gigadrive/sdk/pull/232))

- Updated dependencies [[`0a55d51`](https://github.com/Gigadrive/sdk/commit/0a55d51d3e7ac003b1524b0781c0e8849105f24a)]:
  - @gigadrive/network-config@2.1.2
  - @gigadrive/build-utils@1.0.1
  - @gigadrive/commons@2.1.1

## 1.1.1

### Patch Changes

- Updated dependencies [[`d76b8aa`](https://github.com/Gigadrive/sdk/commit/d76b8aaea3f81ddc010271a9a50d61f650989b9a)]:
  - @gigadrive/network-config@2.1.1

## 1.1.0

### Minor Changes

- add debug config command ([#36](https://github.com/Gigadrive/sdk/pull/36))

### Patch Changes

- fix vercel-related issues and restructure some of the code ([#46](https://github.com/Gigadrive/sdk/pull/46))

- Updated dependencies [[`9e06f36`](https://github.com/Gigadrive/sdk/commit/9e06f3638a51c01c72050f8f9c12eb51c3851966)]:
  - @gigadrive/network-config@2.1.0
  - @gigadrive/commons@2.1.0

## 1.0.2

### Patch Changes

- Updated dependencies [[`62008e5`](https://github.com/Gigadrive/sdk/commit/62008e5f2eb6e16d4a2e33264b57142cf3c1c40d)]:
  - @gigadrive/network-config@2.0.4

## 1.0.1

### Patch Changes

- remove dirname function ([#32](https://github.com/Gigadrive/sdk/pull/32))

- Updated dependencies [[`14d00a2`](https://github.com/Gigadrive/sdk/commit/14d00a2a90deca6f611e1962667556e6b1655297)]:
  - @gigadrive/commons@2.0.0
  - @gigadrive/network-config@2.0.3

## 1.0.0

### Major Changes

- added new commons functions, fixed schema and CLI issues ([#28](https://github.com/Gigadrive/sdk/pull/28))

### Patch Changes

- Updated dependencies [[`e41be7a`](https://github.com/Gigadrive/sdk/commit/e41be7a8798ad53e58438bfb0c78324b47344c72)]:
  - @gigadrive/commons@1.1.0
  - @gigadrive/network-config@2.0.2

## 0.0.4

### Patch Changes

- Updated dependencies [[`75c09ee`](https://github.com/Gigadrive/sdk/commit/75c09ee52836b7798b5235f215924661735ef7f2)]:
  - @gigadrive/network-config@2.0.1

## 0.0.3

### Patch Changes

- fixed exports and typings ([#19](https://github.com/Gigadrive/sdk/pull/19))

- Updated dependencies [[`04703f1`](https://github.com/Gigadrive/sdk/commit/04703f1a9a3adb76994b25c08b840f8cbde4cb84)]:
  - @gigadrive/network-config@2.0.0
  - @gigadrive/build-utils@1.0.0

## 0.0.2

### Patch Changes

- Updated dependencies [[`45f65ed`](https://github.com/Gigadrive/sdk/commit/45f65ed1e6428a248c71c792a17c7c9b6eeb8c39)]:
  - @gigadrive/network-config@1.1.0
  - @gigadrive/build-utils@0.1.0

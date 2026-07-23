# @gigadrive/sdk

## 0.7.17

### Patch Changes

- Updated dependencies [[`0edfa5e`](https://github.com/Gigadrive/sdk/commit/0edfa5e0317a21b84452d84bb3985dd0f6fdaf7c)]:
  - @gigadrive/network-config@3.4.17

## 0.7.16

### Patch Changes

- Updated dependencies [[`296e491`](https://github.com/Gigadrive/sdk/commit/296e49130395f1977565a6207c5eb430eaec5d8a)]:
  - @gigadrive/network-config@3.4.16

## 0.7.15

### Patch Changes

- Updated dependencies [[`d2ff4df`](https://github.com/Gigadrive/sdk/commit/d2ff4dfd5a04941114838194f5f9859a51a5b9f4), [`60e22e0`](https://github.com/Gigadrive/sdk/commit/60e22e06cd0aad6b394a57e230537c7179bfa39d)]:
  - @gigadrive/network-config@3.4.15

## 0.7.14

### Patch Changes

- Updated dependencies [[`d300e34`](https://github.com/Gigadrive/sdk/commit/d300e34dfd51de975754b0a1d4422d6beff13234)]:
  - @gigadrive/network-config@3.4.14

## 0.7.13

### Patch Changes

- Updated dependencies [[`23a8fb3`](https://github.com/Gigadrive/sdk/commit/23a8fb30a46dc22998fdb1266502e2d0b3d74c53)]:
  - @gigadrive/network-config@3.4.13

## 0.7.12

### Patch Changes

- Updated dependencies [[`53e9b24`](https://github.com/Gigadrive/sdk/commit/53e9b2470dca3a010dd174e0d8c383b8cafc1c1b)]:
  - @gigadrive/network-config@3.4.12

## 0.7.11

### Patch Changes

- Updated dependencies [[`0065c5f`](https://github.com/Gigadrive/sdk/commit/0065c5ff15a8d7944e2b56822cf4bf948451509e)]:
  - @gigadrive/network-config@3.4.11

## 0.7.10

### Patch Changes

- Updated dependencies [[`7fed891`](https://github.com/Gigadrive/sdk/commit/7fed8915e144a8fc87b2f2f52290c86e7d05b80f)]:
  - @gigadrive/network-config@3.4.10

## 0.7.9

### Patch Changes

- Updated dependencies [[`26918e7`](https://github.com/Gigadrive/sdk/commit/26918e7469c99e625a791a0e0eebd527860b4dfc)]:
  - @gigadrive/network-config@3.4.9

## 0.7.8

### Patch Changes

- Emit an image filename extension that Bunny Optimizer recognizes for extensionless and dynamic Next.js image sources. ([#366](https://github.com/Gigadrive/sdk/pull/366))

- Persist the incremental-cache envelope required by Next.js so ISR entries can be read after regeneration. ([#368](https://github.com/Gigadrive/sdk/pull/368))

- Updated dependencies [[`aaecb15`](https://github.com/Gigadrive/sdk/commit/aaecb15eb4676c5b109cd1ba76746d0bbf03f210), [`d7ebdfc`](https://github.com/Gigadrive/sdk/commit/d7ebdfcce9f2156272a21cc52031ef696d4abec3)]:
  - @gigadrive/network-config@3.4.8

## 0.7.7

### Patch Changes

- Updated dependencies [[`ea03062`](https://github.com/Gigadrive/sdk/commit/ea0306202eb4c89e96c0a4c73437d610181f2ceb)]:
  - @gigadrive/network-config@3.4.7

## 0.7.6

### Patch Changes

- Updated dependencies [[`b5d430b`](https://github.com/Gigadrive/sdk/commit/b5d430b082124c33a1ebd6c239cc8eeb9beb320d)]:
  - @gigadrive/network-config@3.4.6

## 0.7.5

### Patch Changes

- Updated dependencies [[`8dfb7a4`](https://github.com/Gigadrive/sdk/commit/8dfb7a4ac337a1c87cada7d571c1804a79c973e6)]:
  - @gigadrive/network-config@3.4.5

## 0.7.4

### Patch Changes

- Updated dependencies [[`759d1ee`](https://github.com/Gigadrive/sdk/commit/759d1ee11f0d136ef4200d7ac9cb0d7f9f776680)]:
  - @gigadrive/network-config@3.4.4

## 0.7.3

### Patch Changes

- Updated dependencies [[`e30cc34`](https://github.com/Gigadrive/sdk/commit/e30cc34dcaed19ae93ee599601649bd92161cea4)]:
  - @gigadrive/network-config@3.4.3

## 0.7.2

### Patch Changes

- Updated dependencies [[`4645c12`](https://github.com/Gigadrive/sdk/commit/4645c1200947e508fce5c29f8200dd11fed77fec)]:
  - @gigadrive/network-config@3.4.2

## 0.7.1

### Patch Changes

- Updated dependencies [[`b281599`](https://github.com/Gigadrive/sdk/commit/b281599530e0ae02df3fa98028d1f9b509364a93)]:
  - @gigadrive/network-config@3.4.1

## 0.7.0

### Minor Changes

- Add the Next.js 16 deployment-adapter v2 manifest, split function plans, shared artifacts, runtime cache handlers, framework-neutral managed image policies, image URL helpers, image cache inspection and purge SDK methods, and Next-compatible child-process environment typing. ([#345](https://github.com/Gigadrive/sdk/pull/345))

### Patch Changes

- Updated dependencies [[`7778b12`](https://github.com/Gigadrive/sdk/commit/7778b12937dc3ee2046e632e4d11c78cf502db90)]:
  - @gigadrive/network-config@3.4.0

## 0.6.1

### Patch Changes

- Type deployment debug logs returned by the Network API. ([#335](https://github.com/Gigadrive/sdk/pull/335))

## 0.6.0

### Minor Changes

- Add application creation to the SDK and CLI, and make `gigadrive deploy` automatically create and link an application for an unlinked project. ([#330](https://github.com/Gigadrive/sdk/pull/330))

## 0.5.0

### Minor Changes

- Add the zero-configuration `stickySessions.createUrl` API for routing HTTP, ([#320](https://github.com/Gigadrive/sdk/pull/320))
  streaming, and WebSocket traffic with the same key to one MicroVM instance.

## 0.4.0

### Minor Changes

- Add organization management and product entitlement APIs to the SDK. ([#315](https://github.com/Gigadrive/sdk/pull/315))

  `client.organizations` now supports `get` and `create`, plus nested
  `members.list` and `products` helpers for listing product access and checking
  entitlements. Product subscriptions are read-only through the public API.

## 0.3.0

### Minor Changes

- Add `gigadrive env pull` and `gigadrive setup` for local development ([#308](https://github.com/Gigadrive/sdk/pull/308))

  - `gigadrive env pull [file]` pulls a project's resolved, non-sensitive environment
    variables to a local `.env.local` (written 0600 and added to `.gitignore`).
    `--with-credentials` additionally provisions least-privilege, application-scoped
    API credentials (`GIGADRIVE_CLIENT_ID` / `GIGADRIVE_CLIENT_SECRET` /
    `GIGADRIVE_API_BASE_URL`) with rotate/reuse so the local app can call the API.
  - `gigadrive setup` wires up a fresh checkout end to end: link (if needed) → pull →
    provision credentials.
  - CLI login now requests the Network API capability scopes it uses.
  - SDK: `client.applications.envVars.pull(...)` and a new `client.apiKeys` resource
    (create / list / delete).

## 0.2.0

### Minor Changes

- Add application hostname management to the SDK and broaden CLI coverage of the Gigadrive Network API. ([#307](https://github.com/Gigadrive/sdk/pull/307))

  **@gigadrive/sdk**
  - `client.applications.checkHostnameAvailability(applicationId, label)` — check whether a production hostname label is available (`GET /applications/:id/hostname/availability`).
  - `client.applications.setProductionHostname(applicationId, label)` — set the application's production hostname (`PUT /applications/:id/hostname`).
  - New exported types `HostnameAvailability` and `SetProductionHostnameResult`.

  **gigadrive (CLI)**
  - New `ApiClientService` — a single, shared factory for the authenticated `@gigadrive/sdk` client used by every API-backed command. `DeploymentApiService` now delegates to it.
  - Project linking: `gigadrive link` / `gigadrive unlink` persist the selected application to `.gigadrive/project.json`; `gigadrive platform deploy` now deploys to the linked application (or `--app`) instead of a hard-coded ID and prints the real `*.gigadrive.app` hostname on success.
  - New commands: `gigadrive apps list`, `gigadrive env list|set|rm`, `gigadrive deployments list|inspect`, `gigadrive ai usage|budgets|policies|models|chat`, and `gigadrive logout`.
  - `GIGADRIVE_API_BASE_URL` now defaults to the production API (`https://api.gigadrive.network`), and the CLI version is sourced from `package.json`.

- Production-grade file uploads and a complete, corrected API surface. ([#302](https://github.com/Gigadrive/sdk/pull/302))

  **File uploads (storage):** new high-level `client.applications.storage.upload()` that auto-computes the required SHA-256, infers content type, and uploads with progress, `AbortSignal` cancellation, and resumable retries. Supports browser `File`/`Blob`, Node `Buffer`/`Uint8Array`/`ArrayBuffer`, a Node file `path`, and Node readable `stream`s. Adds `uploadBatch()` (concurrent, per-file error isolation), `waitForCompletion()`, and `uploadSessions.uploadToUrl()`/`resumeFromUrl()`.

  **Correctness fixes (breaking, pre-1.0):**
  - AI Gateway endpoints now use the correct `/ai/v1` base path (were `/v1`).
  - Storage objects are addressed by object ID; `getAccessUrl()` now takes a `bucketId` and supports `expiresInSeconds`. Object listing supports `prefix`/`delimiter`/`cursor`/`limit` and returns `commonPrefixes`/`nextCursor`; added `getByKey()`.
  - Upload-session creation now sends the required SHA-256 checksum.
  - Bucket creation requires `environmentId` and accepts an optional `slug`.
  - Removed non-public provider fields from `StorageBucket`/`StorageObject`.
  - Corrected the `DeploymentStatus` union.

  **New surface:** streamed chat completions (`chatCompletionsStream`), Responses, audio (speech/transcriptions), video generation, and richer model metadata; organization-scoped AI Gateway governance (`organizations.aiGateway` usage/budgets/policies); application & deployment hostnames; application request logs; list pagination (`page`/`perPage`/`cursor`) with a `paginate()` helper; and a README with a full upload guide.

## 0.1.2

### Patch Changes

- update dependencies ([#232](https://github.com/Gigadrive/sdk/pull/232))

## 0.1.1

### Patch Changes

- fixed exports and typings ([#19](https://github.com/Gigadrive/sdk/pull/19))

## 0.1.0

### Minor Changes

- add typings ([#10](https://github.com/Gigadrive/sdk/pull/10))

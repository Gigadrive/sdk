# @gigadrive/sdk

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

---
'@gigadrive/sdk': minor
---

Production-grade file uploads and a complete, corrected API surface.

**File uploads (storage):** new high-level `client.applications.storage.upload()` that auto-computes the required SHA-256, infers content type, and uploads with progress, `AbortSignal` cancellation, and resumable retries. Supports browser `File`/`Blob`, Node `Buffer`/`Uint8Array`/`ArrayBuffer`, a Node file `path`, and Node readable `stream`s. Adds `uploadBatch()` (concurrent, per-file error isolation), `waitForCompletion()`, and `uploadSessions.uploadToUrl()`/`resumeFromUrl()`.

**Correctness fixes (breaking, pre-1.0):**

- AI Gateway endpoints now use the correct `/ai/v1` base path (were `/v1`).
- Storage objects are addressed by object ID; `getAccessUrl()` now takes a `bucketId` and supports `expiresInSeconds`. Object listing supports `prefix`/`delimiter`/`cursor`/`limit` and returns `commonPrefixes`/`nextCursor`; added `getByKey()`.
- Upload-session creation now sends the required SHA-256 checksum.
- Bucket creation requires `environmentId` and accepts an optional `slug`.
- Removed non-public provider fields from `StorageBucket`/`StorageObject`.
- Corrected the `DeploymentStatus` union.

**New surface:** streamed chat completions (`chatCompletionsStream`), Responses, audio (speech/transcriptions), video generation, and richer model metadata; organization-scoped AI Gateway governance (`organizations.aiGateway` usage/budgets/policies); application & deployment hostnames; application request logs; list pagination (`page`/`perPage`/`cursor`) with a `paginate()` helper; and a README with a full upload guide.

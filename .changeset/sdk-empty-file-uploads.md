---
'@gigadrive/sdk': minor
---

`client.storage.upload()` and `uploadBatch()` now support empty (zero-byte) files such as `.gitkeep` or `__init__.py`.

The Network API stores an empty object while it creates the upload session. It returns the session already
`completed`, with `upload: null` and the stored `object`. The SDK skips the tus transfer and any
`waitForCompletion` polling in that case, so an empty file takes one API call. It returns `object` and `url` from
the response. An API deployment that doesn't send the top-level `publicObjectUrl` yet costs one extra bucket lookup
to build `url`. Every input kind (`path`, `stream`, `Buffer`,
`Uint8Array`, `ArrayBuffer`, `Blob`) sends `contentLength: 0` with the empty SHA-256. An empty `stream` only needs
`contentLength: 0`, because the SDK fills in the digest.

`CreateUploadSessionResponse.upload` is now nullable. The response has a new `object: StorageObject | null` field
and an optional top-level `publicObjectUrl`. If you call `client.storage.uploadSessions.create()` directly, check `upload` before you start a transfer.

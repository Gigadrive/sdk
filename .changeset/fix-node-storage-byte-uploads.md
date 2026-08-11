---
'@gigadrive/sdk': patch
---

Fix Node.js storage uploads from `Blob`, `Uint8Array`, and `ArrayBuffer` inputs by converting them to a `Buffer` before invoking the resumable upload transport.

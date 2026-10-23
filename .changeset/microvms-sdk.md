---
'@gigadrive/sdk': minor
---

Add microVMs: `MicroVM.create/get/list`, `vm.run` and `vm.spawn` with streamed, resumable command output (`Command.logs/wait/kill/write/resize`), `vm.files` (read, write, writeMany, list, stat, exists, mkdir, remove, move), preview URLs with `vm.url` and `vm.waitForPort`, `vm.extendTimeout/stop/delete` and `await using` disposal, custom images through `client.microvms.images`, typed errors, and the low-level `client.microvms` REST resource. `parseSSEEvents` exposes SSE event names and ids, and streamed request bodies now send `duplex: 'half'`.

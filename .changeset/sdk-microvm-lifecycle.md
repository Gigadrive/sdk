---
'@gigadrive/sdk': minor
---

Add microVM pause, resume and snapshots, and keep waiting through `202` answers:

- `client.microvms.pause`, `resume` and `snapshot`, with `wait`, and `client.microvms.waitUntilSettled` to poll a microVM until its status stops changing on its own.
- `client.microvms.snapshots`: `list`, `listAll`, `get`, `delete` and `waitUntilSettled`; create a microVM from one with `snapshotId`.
- `MicroVM#pause`, `MicroVM#resume` and `MicroVM#snapshot` wait until the change finished, whether the API answered `200`/`201` or `202`.
- `client.microvms.commands.run` and `vm.run` handle a `202` answer for a command that runs longer than the API holds a request: they keep waiting with `POST .../wait` in 45-second slices and read the output from the command log, so callers still get the exit code and output.

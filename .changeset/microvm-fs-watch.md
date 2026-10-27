---
'@gigadrive/sdk': minor
---

Watch a microVM directory. `vm.files.watch(path, { recursive })` iterates every change (`create`, `write`, `remove`, `rename`, `chmod`, `overflow`) until the directory is deleted or moved, or the loop ends. A microVM started before watching was available throws `MicroVmWatchUnsupportedError`, and a watch that fails partway throws `MicroVmWatchInterruptedError`.

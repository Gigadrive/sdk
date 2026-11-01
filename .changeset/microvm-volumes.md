---
'@gigadrive/sdk': minor
'gigadrive': minor
---

microVM volumes: persistent filesystems that outlive the microVMs they are attached to. `client.microvms.volumes` creates, lists, renames and deletes them, `MicroVM.create({ volumes: [{ volumeId, mountPath }] })` attaches up to four, `vm.saveVolumes()` saves them without stopping, and `vm.stop()` now waits until the volumes are saved. The CLI adds `gigadrive microvms volumes ls|create|rename|save|rm` and `microvms create --volume NAME:PATH`. The Python SDK adds `MicroVmVolumes`, `MicroVM.create(volumes=...)` and `vm.save_volumes()`.

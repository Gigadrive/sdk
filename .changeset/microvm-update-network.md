---
'gigadrive': minor
'@gigadrive/sdk': minor
---

Change what a running or paused microVM may reach without restarting it. `vm.updateNetwork('deny')`, `vm.updateNetwork({ egress: 'allow', allow: ['registry.npmjs.org'] })` and `client.microvms.updateNetwork(id, policy)` replace its egress policy, and `gigadrive microvms network <id>` takes `--deny-egress`, `--allow-egress` or `--allow-all-egress`. Connections the new rules no longer allow are closed; the others continue, and a paused microVM gets the new rules when it resumes.

`MicroVM.create({ onTimeout: 'pause' })` and `gigadrive microvms create --pause-on-timeout` pause a microVM when its timeout ends instead of stopping it, keeping its memory, processes and files for the plan's pause retention; a resume runs it for its full timeout again.

`MicroVM.create({ autoResume: true })` and `gigadrive microvms create --auto-resume` resume a paused microVM on its own: a command or file call resumes it and waits, and a request to a public preview URL resumes it and waits up to 20 seconds.

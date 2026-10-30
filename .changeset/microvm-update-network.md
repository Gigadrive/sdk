---
'gigadrive': minor
'@gigadrive/sdk': minor
---

Change what a running or paused microVM may reach without restarting it. `vm.updateNetwork('deny')`, `vm.updateNetwork({ egress: 'allow', allow: ['registry.npmjs.org'] })` and `client.microvms.updateNetwork(id, policy)` replace its egress policy, and `gigadrive microvms network <id>` takes `--deny-egress`, `--allow-egress` or `--allow-all-egress`. Connections the new rules no longer allow are closed; the others continue, and a paused microVM gets the new rules when it resumes.

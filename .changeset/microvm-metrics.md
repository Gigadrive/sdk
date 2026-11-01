---
'@gigadrive/sdk': minor
'gigadrive': minor
---

Read a microVM's CPU, memory and disk use. `vm.getMetrics()` and `client.microvms.getMetrics(id, { windowMinutes })` return its CPU over the last `windowMinutes` (default 15, at most a day) as `{ time, cpuPercent }` points, and, while it runs, the memory and disk in use as the microVM reports them. `gigadrive microvms metrics <id> [--window <minutes>] [--json]` prints the same. Reading metrics never resumes a paused microVM.

---
'@gigadrive/network-config': patch
---

The Next.js runtime cache client now re-establishes its connection and refreshes its workload token when the microVM resumes from a suspend snapshot (SIGUSR2), so the first request after a wake no longer serializes behind reconnection.

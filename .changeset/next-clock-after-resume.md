---
'@gigadrive/network-config': patch
---

Report Next.js cache entries at their real age in processes resumed from a snapshot, where Next's monotonic clock falls behind the wall clock and entries would otherwise never go stale.

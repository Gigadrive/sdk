---
'@gigadrive/network-config': patch
---

Regenerate the aggregate server traces Next 16.3 stopped emitting in adapter builds.

Next 16.3 no longer writes `.next/next-server.js.nft.json` (and
`next-minimal-server.js.nft.json`) from Turbopack builds when an adapter is
configured, but `next build` still runs its `output: 'standalone'` writer after
`onBuildComplete` — and that writer reads exactly this file, killing the build
with `ENOENT` even though compilation succeeded. The managed runtime always
builds standalone, so every Next 16.3 deployment failed at this step.

`onBuildComplete` now checks for the aggregate trace and, when missing,
regenerates both files with Next's own `collectBuildTraces` before the
standalone writer needs them. Next 16.2 and webpack builds still emit the file
themselves and skip the regeneration entirely.

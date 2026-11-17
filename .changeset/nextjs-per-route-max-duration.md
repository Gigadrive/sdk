---
'@gigadrive/network-config': minor
---

Record each Next.js route's own `maxDuration` and `preferredRegion` in `.gigadrive/nextjs.json`. The build adapter now writes `server.routes`, a table keyed by the pathname of every route output, next to the server-wide `server.maxDuration`. A route that sets no segment config is listed with an empty entry, so a platform can give it the default duration instead of the longest limit of another route.

The standalone server's duration now also covers the platform default when any route sets no `maxDuration`. Before, an app whose only configured route set a limit below the default held every other route to that shorter limit.

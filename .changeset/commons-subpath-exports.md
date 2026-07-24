---
'@gigadrive/commons': minor
---

Add per-module subpath exports (e.g. `@gigadrive/commons/format`) so pure, browser-safe utilities can be imported without pulling in the Node-only modules (`encrypt`/`decrypt`, `sha256`, `buffered-readable-stream`). This fixes client-side bundling crashes in environments without Node globals. The root `.` export is unchanged and remains a full barrel.

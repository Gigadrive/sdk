---
'@gigadrive/network-config': minor
---

Support cron jobs for Next.js apps in the shape Vercel uses. A Next.js project's `vercel.json` `crons` list is now read during detection, and `gigadrive.yaml` accepts a top-level `crons` list with the same `path` and `schedule` entries. The config file's list replaces the one in `vercel.json` when it is set, even to an empty list, and declaring cron jobs keeps the Next.js integration on.

The normalized config carries the result as `crons`. A schedule must be a five-field cron expression evaluated in UTC, and a path must start with `/`. Invalid entries in `gigadrive.yaml` are config errors; invalid entries in `vercel.json`, which deployments did not read before, are skipped with a warning. Cron jobs are kept only when one function serves every path, such as a Next.js server, so a static export skips them with a warning.

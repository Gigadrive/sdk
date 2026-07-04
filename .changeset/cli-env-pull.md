---
'gigadrive': minor
'@gigadrive/sdk': minor
---

Add `gigadrive env pull` and `gigadrive setup` for local development

- `gigadrive env pull [file]` pulls a project's resolved, non-sensitive environment
  variables to a local `.env.local` (written 0600 and added to `.gitignore`).
  `--with-credentials` additionally provisions least-privilege, application-scoped
  API credentials (`GIGADRIVE_CLIENT_ID` / `GIGADRIVE_CLIENT_SECRET` /
  `GIGADRIVE_API_BASE_URL`) with rotate/reuse so the local app can call the API.
- `gigadrive setup` wires up a fresh checkout end to end: link (if needed) → pull →
  provision credentials.
- CLI login now requests the Network API capability scopes it uses.
- SDK: `client.applications.envVars.pull(...)` and a new `client.apiKeys` resource
  (create / list / delete).

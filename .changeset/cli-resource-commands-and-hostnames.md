---
'@gigadrive/sdk': minor
'gigadrive': minor
---

Add application hostname management to the SDK and broaden CLI coverage of the Gigadrive Network API.

**@gigadrive/sdk**

- `client.applications.checkHostnameAvailability(applicationId, label)` — check whether a production hostname label is available (`GET /applications/:id/hostname/availability`).
- `client.applications.setProductionHostname(applicationId, label)` — set the application's production hostname (`PUT /applications/:id/hostname`).
- New exported types `HostnameAvailability` and `SetProductionHostnameResult`.

**gigadrive (CLI)**

- New `ApiClientService` — a single, shared factory for the authenticated `@gigadrive/sdk` client used by every API-backed command. `DeploymentApiService` now delegates to it.
- Project linking: `gigadrive link` / `gigadrive unlink` persist the selected application to `.gigadrive/project.json`; `gigadrive platform deploy` now deploys to the linked application (or `--app`) instead of a hard-coded ID and prints the real `*.gigadrive.app` hostname on success.
- New commands: `gigadrive apps list`, `gigadrive env list|set|rm`, `gigadrive deployments list|inspect`, `gigadrive ai usage|budgets|policies|models|chat`, and `gigadrive logout`.
- `GIGADRIVE_API_BASE_URL` now defaults to the production API (`https://api.gigadrive.network`), and the CLI version is sourced from `package.json`.

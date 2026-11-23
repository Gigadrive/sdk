---
'gigadrive': minor
---

Close the gaps found in the microVM benchmark:

- `microvms create --port` works again: `-p 3000 -p 8080`, `--port 3000`, `-p=3000` and `--port=3000` are all accepted, and a value that is not a port from 1 to 65535 is refused with a clear message instead of being dropped.
- `microvms create` waits until the microVM runs when the API answers while it still waits for capacity, with a progress line on stderr (so `--json` stays parseable). It exits non-zero with the stop reason when the microVM fails to start. New `--wait-timeout` (default 8m) and `--no-wait`.
- New `microvms pause`, `resume`, `snapshot`, `snapshots ls|get|rm` and `fork <snapshot-id>`. Each one accepts a `202` answer and polls until the change finished, with progress on stderr, and supports `--json`.
- `microvms cp` copies 8 files at a time (`--concurrency` to change it), retries a file after a server or network error, and shows progress on stderr.
- Faster startup: `--version` answers without loading the CLI, `@effect/platform-node` is loaded through its subpaths, the OIDC discovery document is cached on disk for its HTTP cache lifetime (24 hours without cache headers), and the access token is refreshed 30 seconds before it expires and kept current during long commands.
- Errors print one line with what to do next (for example "Pass --app <id> or run `gigadrive link`", or "<id> is not a microVM ID"); stack traces only at `--log-level debug`. The default log level is now `warning`, and `--log-level` is accepted after the subcommand.

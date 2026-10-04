---
'@gigadrive/sdk': minor
'gigadrive': minor
---

Custom domains for Gigadrive Network applications.

- **SDK:** `client.applications.domains` lists, adds, updates, checks, removes and claims custom
  domains, and `waitUntilActive()` polls until a domain serves traffic. It throws
  `DomainNotActiveError` when the domain fails, is suspended or removed, or the wait runs out of
  time; rate limits, server errors and network failures are retried until the timeout, and aborting
  or timing out cancels the request in flight. `client.organizations.domains` manages the domains an
  organization verified with a TXT record. `Hostname.type` now includes `'CUSTOM'`, and `ApiError`
  also exposes the `code` and `reason` the API sends next to a string `error`.
- **CLI:** `gigadrive domains list|add|update|claim|inspect|check|rm` and `gigadrive domains owners
list|add|verify|rm`. `domains add` prints the DNS records to publish as a table, supports
  `--production`, `--branch`, or `--redirect-to` with `--status` and `--drop-path` (conflicting
  flags are refused), and `--wait` to follow the domain until it is live. `list`, `add`, `update`,
  `claim`, `inspect`, `check`, `owners list` and `owners add` accept `--json`, which prints only the
  result on stdout. Removing asks for confirmation, or requires
  `--yes` when not running in a terminal.

---
'@gigadrive/sdk': minor
'gigadrive': minor
---

Custom domains for Gigadrive Network applications.

- **SDK:** `client.applications.domains` lists, adds, updates, checks, removes and claims custom
  domains, and `waitUntilActive()` polls until a domain serves traffic (throwing
  `DomainNotActiveError` when it fails, is suspended or runs out of time).
  `client.organizations.domains` manages the domains an organization verified with a TXT record.
  `Hostname.type` now includes `'CUSTOM'`, and `ApiError.code` is also read when the API sends it
  next to a string `error`.
- **CLI:** `gigadrive domains list|add|inspect|check|rm` and `gigadrive domains owners
list|add|verify`. `domains add` prints the DNS records to publish as a table, supports
  `--branch`, `--redirect-to` with `--status` and `--drop-path`, and `--wait` to follow the domain
  until it is live. Listing and inspecting commands accept `--json`.

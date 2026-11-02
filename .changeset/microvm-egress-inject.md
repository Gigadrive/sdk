---
'@gigadrive/sdk': minor
'gigadrive': minor
---

microVMs can add headers to their HTTPS requests to chosen domains, so a credential reaches an API without entering the microVM: `network.inject` on `MicroVM.create` and `updateNetwork`, `--inject DOMAIN:HEADER=VALUE` on `gigadrive microvms create` and `gigadrive microvms network` (with `--clear-inject` to remove the rules), and `inject=` in the Python client. Responses list the header names, never the values.

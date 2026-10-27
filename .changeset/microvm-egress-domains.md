---
'gigadrive': minor
'@gigadrive/sdk': patch
---

Egress allowlists take domain names. `MicroVM.create({ network: { egress: 'allow', allow: ['api.openai.com', '*.github.com'] } })` lets a microVM reach only those names (`*.` covers every subdomain) alongside any public IPv4 networks in the same list, and `gigadrive microvms create --allow-egress api.openai.com` accepts a name. A name is allowed by the addresses the microVM resolves it to: lookups of other names fail, and an address no allowed name resolved to is blocked.

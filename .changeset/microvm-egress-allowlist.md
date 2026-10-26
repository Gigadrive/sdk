---
'@gigadrive/sdk': minor
'gigadrive': minor
---

Egress allowlists for microVMs. `MicroVM.create({ network: { egress: 'allow', allow: ['140.82.112.0/20'] } })` lets a microVM reach only the listed public IPv4 networks besides DNS, and `vm.info.network.allow` shows the list. The CLI gains a repeatable `gigadrive microvms create --allow-egress <network>`, and `microvms get` names the allowed networks.

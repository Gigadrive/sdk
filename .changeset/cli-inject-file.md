---
'gigadrive': minor
---

`gigadrive microvms create` and `gigadrive microvms network` take `--inject-file <path>`: the `--inject` rules, one `DOMAIN:HEADER=VALUE` per line (blank lines and `#` comments skipped), read from a file or from `/dev/stdin`. Unlike `--inject`, the values never appear in the process arguments, where other users of the same machine could read them.

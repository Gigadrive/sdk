---
'@gigadrive/network-config': minor
'gigadrive': minor
---

A Dockerfile can be a function like any other: list it under `functions` with `runtime: docker` (for example `functions: { Dockerfile: { runtime: docker, port: 3000 } }`) and route to it by its path. The build context is the Dockerfile's directory, and a pattern such as `services/*/Dockerfile` makes one function per Dockerfile. `port` is accepted only with `runtime: docker`.

Container functions declared next to a detected framework now join the framework's app instead of replacing it, and routes to them take precedence over the framework's routes. Container names start with a letter, because a name such as `1234` resolves as an IP address before `/etc/hosts`.

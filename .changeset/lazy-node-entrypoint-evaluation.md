---
'@gigadrive/network-config': patch
---

Import Node route and middleware entrypoints lazily on the first request; eager top-level evaluation deadlocked MicroVM guests whose route module graphs block before the server is listening.

---
'@gigadrive/sdk': patch
---

`MicroVM.create` starts the microVM without holding the request open and polls until it runs (up to 10 minutes, covering a wait for capacity), so proxies in front of the API can't cut a long create short. When it gives up (time out or abort), it deletes the microVM so it never boots unseen.

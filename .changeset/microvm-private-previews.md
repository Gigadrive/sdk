---
'@gigadrive/sdk': minor
'gigadrive': minor
---

Private preview URLs for microVMs. `MicroVM.create({ previews: 'private' })` makes a microVM's preview URLs answer only requests that carry its preview token, which the create answer shows once as `vm.previewToken`. `vm.waitForPort()` sends the token, `vm.shareUrl(port)` builds a browser link that signs in with it, `vm.rotatePreviewToken()` revokes the old token, and `MicroVM.get(id, { previewToken })` reattaches it. `MicroVmPreviewTokenRequiredError` reports a private microVM without a valid token. The CLI gains `gigadrive microvms create --private-previews`, which prints the token once.

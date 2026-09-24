---
'@gigadrive/sdk': patch
---

`client.storage.uploadSessions.uploadToUrl()` and `resumeFromUrl()` now close the file they open for a `path` source
when the upload finishes, fails, or is aborted. Before, a failed or aborted path upload left the file open.

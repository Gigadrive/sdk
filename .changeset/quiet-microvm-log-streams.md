---
'@gigadrive/sdk': patch
---

Keep following a quiet microVM command's output. The host ends a command's output stream after 15 idle minutes, which the API reports as a retryable error, and the SDK counted every such close as a failed reconnect, so `logs()`, `output()` and streamed `run()` calls failed after about 90 quiet minutes. A connection that stayed open at least 30 seconds before closing or failing, with the command confirmed still running, no longer counts.

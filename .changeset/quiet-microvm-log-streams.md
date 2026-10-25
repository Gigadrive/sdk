---
'@gigadrive/sdk': patch
---

Keep following a quiet microVM command's output. The host closes a command's output stream after 15 idle minutes, and the SDK counted every such close as a failed reconnect, so `logs()`, `output()` and streamed `run()` calls threw `log_stream_closed` after about 90 quiet minutes. A close after a connection that stayed open at least 30 seconds, with the command confirmed still running, no longer counts.

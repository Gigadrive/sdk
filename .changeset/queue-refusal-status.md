---
'@gigadrive/sdk': patch
---

A refused queue send now raises `ApiError` with status 400 when the refusal is not retryable, and keeps 429 for refusals that may succeed later, so retry logic that keys on the status no longer retries a message the platform will never accept.

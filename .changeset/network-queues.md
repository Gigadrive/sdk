---
'@gigadrive/sdk': minor
'@gigadrive/network-config': minor
---

Add Network Queues.

`@gigadrive/sdk` gains a typed queue client. `queue<T>(name)` returns a handle that works with no configuration inside a
deployment:

- `send(payload, { delay, at, groupKey, deduplicationKey, deploymentId, headers })` and `sendBatch()` for immediate,
  delayed and scheduled sends (up to a year ahead), ordering groups and deduplication. `cancel(messageId)` deletes a
  message that has not been processed.
- `handler(fn)` builds a push consumer (`(request: Request) => Promise<Response>`, such as a Next.js route handler).
  It verifies the delivery signature with `GIGADRIVE_QUEUE_SIGNING_SECRET`. Throw `RetryLaterError('5m')` to defer a
  message without spending an attempt, or `NonRetryableError` to dead-letter it.
- `receive()` and `consume()` for pull queues, with `ack`, `retry`, `defer`, `deadLetter` and `extendLease` on each
  message. `consume()` acknowledges messages that finish together in one batch request
  (`client.queues.ackBatch()`, up to 100 messages, one billed operation per started ten acknowledged messages),
  retrying a batch that failed in transit or with a 5xx or 429.
- `ensure()`, `pause()`, `resume()`, `purge()`, `redrive()`, `schedule()` and `unschedule()` for management and cron
  schedules.

`client.queues` exposes the same API over REST, and `createWorkflowQueue()` implements the Workflow SDK World `Queue`
interface on top of it, pinning every message to the deployment that sent it. `verifyQueueSignature()` and `signQueueDelivery()` are exported for custom servers and tests.
`ApiError.code` now also reads a top-level `code` next to a string `error`.

`@gigadrive/network-config` accepts `services.queues` in `gigadrive.yaml`: queues keyed by name with an optional
`consumer` path, delivery and retry settings (durations such as `10m` or seconds), concurrency, rate limits and cron
`schedules`. They normalize to a `queues` service with durations in seconds and schedule bodies as strings.

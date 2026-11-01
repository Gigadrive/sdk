---
'@gigadrive/sdk': minor
'gigadrive': minor
---

Receive microVM lifecycle webhooks. `client.microvms.webhooks` lists, creates, updates, deletes and rotates the secret of an application's webhooks, and lists a webhook's recent deliveries. A webhook gets a signed `POST` when a microVM is created, starts, pauses, stops or fails. `verifyMicroVmWebhook({ body, headers, secret })` checks the Standard Webhooks signature and timestamp of a request and returns its event, throwing `MicroVmWebhookVerificationError` otherwise. `gigadrive microvms webhooks ls | add <url> [--event ...] | enable | disable | rotate-secret | deliveries | rm` manages them from the terminal. The Python SDK gains `MicroVmWebhooks` and `verify_microvm_webhook`.

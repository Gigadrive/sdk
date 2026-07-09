---
'@gigadrive/sdk': minor
---

Add organization management and product entitlement APIs to the SDK.

`client.organizations` now supports `get` and `create`, plus nested
`members.list` and `products` helpers for listing product access and checking
entitlements. Product subscriptions are read-only through the public API.

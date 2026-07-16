---
'@gigadrive/harmony': patch
---

Fix `Button asChild` rendering nothing

`wrapTextNodes` uses `React.Children.map`, which always returns an array. Radix
`Slot` (used when `asChild` is set) renders `null` unless it receives a single
valid React element, so every `<Button asChild>` rendered empty — in the
browser, in SSR, and in tests. `wrapTextNodes` now unwraps a lone child before
returning, so `asChild` works while rendering stays otherwise identical.

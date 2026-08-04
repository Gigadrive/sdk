---
'@gigadrive/harmony': minor
---

Remove the `--text-correction` CSS variable and the `wrapTextNodes()` utility.

Both existed to nudge text that sat 2-3px low on Windows. The real cause was Resist
Sans' inconsistent vertical metrics, now fixed at the source by the
`ascent-override`/`descent-override`/`line-gap-override` descriptors on each
`@font-face`. A fixed nudge could never work anyway — the offset scales with the em, so
any single value was correct at exactly one font-size on one platform.

`Badge`, `Button`, `Avatar` and `FileTree` no longer wrap their text children in an
extra `<span>`. Rendering is unchanged (the variable had been `0`), but any consumer
selecting or styling that wrapper span will need to adjust.

`wrapTextNodes` is no longer exported from `@gigadrive/harmony`. Released as a minor
because it had no known consumers.

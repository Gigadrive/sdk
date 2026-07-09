---
'@gigadrive/harmony': minor
---

Open-source the Network console's declarative layered navigation into Harmony's
existing `Sidebar`.

`SidebarContent` now accepts optional `rootLayer` + `pathname` (and `linkAs` for
framework router links) to drive nested nav from a declarative tree, while
keeping the existing children-based layer API. New exports: `SidebarNavItem`,
`SidebarNavSection`, `SidebarNavLayer`, and `useSidebarLayer`.

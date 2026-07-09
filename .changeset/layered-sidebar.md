---
'@gigadrive/harmony': minor
---

Open-source the Network console's declarative layered navigation into Harmony's
existing `Sidebar`, and add shadcn's CSS-only `scroll-fade` utilities.

`SidebarContent` now accepts optional `rootLayer` + `pathname` (and `linkAs` for
framework router links) to drive nested nav from a declarative tree, while
keeping the existing children-based layer API. New exports: `SidebarNavItem`,
`SidebarNavSection`, `SidebarNavLayer`, and `useSidebarLayer`.

Layer chrome (back/title control, section labels, nav items, active indicator,
and collapsed icon buttons) follows the Network console layered-sidebar styles
so the open-sourced sidebar matches the product UI rather than the older Harmony
item chrome. Icon-collapse uses a `3.25rem` rail that fits `size-9` buttons, and
fixed toolbar rails can opt into `iconRail` for always-icon chrome. Right-side
sidebars flip tooltips and active indicators.

Also ports shadcn `scroll-fade` / `scroll-fade-x` / edge variants (and
`no-scrollbar`) as a Tailwind v3 plugin, and applies `scroll-fade` to the
sidebar content scroller, `SidebarInset`, and `ScrollArea` viewport.

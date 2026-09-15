---
'@gigadrive/harmony': minor
---

EmptyState now fills the width of its container instead of capping itself at 620px.

The root element no longer carries `max-w-[620px]`, so the dashed box spans whatever
container it is placed in — most visibly inside `DataTable`'s `emptyState` slot, where it
previously covered only the first columns of a wide table. The readability constraint moved
to the title/description wrapper (`mx-auto max-w-lg`), so long descriptions still wrap at a
comfortable measure on wide screens. Padding now scales with the viewport
(`p-8 sm:p-12 lg:p-16`) instead of a flat `p-20`, which keeps the box from eating excessive
vertical space now that it can be much wider, and from crowding small screens.

**Migration:** `className="max-w-none"` workarounds at call sites become no-ops and can be
removed at your convenience. To keep the old behaviour, pass the cap explicitly, and override
the padding at every breakpoint the default sets — `cn()` merges per breakpoint, so a bare
`p-20` leaves `sm:p-12` and `lg:p-16` in place:
`<EmptyState className="mx-auto max-w-[620px] p-20 sm:p-20 lg:p-20" … />`.

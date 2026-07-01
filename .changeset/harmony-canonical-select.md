---
'@gigadrive/harmony': major
---

Replace `Select` with the canonical shadcn implementation.

**BREAKING:**

- Removes the indicator `Context` and the `indicatorPosition` / `indicatorVisibility` / `indicator` props on `Select`, along with the `SelectIndicator` export. Compose a custom item indicator manually if you relied on these.
- Trigger `size` is now `sm` | `default` (previously `sm` | `md` | `lg`); the default is `default`.
- `SelectContent` now defaults to `item-aligned` positioning (previously `popper`). Pass `position="popper"` to restore the old behaviour.

The selected-item check indicator now renders on the right, and the component adopts shadcn's current `data-slot` styling and dynamic max-height.

**Fix:** normalize Tailwind v4-only utilities to their Tailwind v3 equivalents across the library (harmony is pinned to Tailwind v3). These classes previously emitted no CSS, most visibly leaving a stray native focus outline — a white ring in dark mode / black in light mode — on hovered/highlighted items. Affected components: `Select`, `Popover`, `Command`, `Calendar`, `ContextMenu`, and `ButtonGroup` (`outline-hidden`→`outline-none`, `shadow-xs`→`shadow-sm`, `has-focus:`→`has-[:focus]:`, `**:`→`[&_…]`, and `foo-(--bar)`→`foo-[var(--bar)]`).

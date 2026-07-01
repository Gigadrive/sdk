---
'@gigadrive/harmony': major
---

Replace `Select` with the canonical shadcn implementation.

**BREAKING:**

- Removes the indicator `Context` and the `indicatorPosition` / `indicatorVisibility` / `indicator` props on `Select`, along with the `SelectIndicator` export. Compose a custom item indicator manually if you relied on these.
- Trigger `size` is now `sm` | `default` (previously `sm` | `md` | `lg`); the default is `default`.
- `SelectContent` now defaults to `item-aligned` positioning (previously `popper`). Pass `position="popper"` to restore the old behaviour.

The selected-item check indicator now renders on the right, and the component adopts shadcn's current `data-slot` styling and dynamic max-height.

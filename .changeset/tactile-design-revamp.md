---
'@gigadrive/harmony': major
---

Tactile design revamp (Harmony 5.0)

Depth is now the design language: raised elements are glossy, sunken elements are
recessed. Buttons keep their signature glossy finish; the rest of the system moves
toward it.

**Breaking — theme tokens (`theme.css`)**

- Dark surfaces are layered and lifted: background 6.7%, card 10%, popover 12%
  (previously card == background == 3.9%). Light background is a soft green-tinted
  off-white with pure-white cards.
- `--primary-foreground` is now pure white (was pink-tinted). Brand green `#16A34A`
  is unchanged.
- `--radius` is now `0.75rem`. Sidebar tokens are brand-aligned (dark-mode blue
  `--sidebar-primary`/`--sidebar-ring` removed); chart tokens are anchored on the
  brand green.
- New semantic status tokens: `--success/--warning/--danger/--info` + `-soft`
  variants, exposed in Tailwind as `text-success`, `bg-danger-soft`, etc.
- New depth primitives shipped in `theme.css`: `.card-tactile`, `.well`, `.raised`,
  `.raised-on-active`, `.fill-gloss`.
- `theme.css` must be paired with `style.css` (it always should have been):
  `style.css` carries the global `border-color` fix and scrollbar/base styles.

**Breaking — components**

- `Input`/`Textarea`: the floating label is replaced by a top label + recessed field
  (the floating label was broken — missing `peer` classes, hardcoded
  `bg-white dark:bg-stone-950`). The `label`/`error`/`helpText` props are unchanged;
  only the rendering differs. Error styles now use the `danger` tokens.
- `Card`: `rounded-xl` + tactile elevation; `CardTitle` is `text-base font-semibold`
  (was `text-2xl`).
- `Tabs`: segmented style — recessed track, raised active thumb.
- `Button`: deeper dark-mode shadow, `outline` sits on `bg-card`, `ghost` is neutral
  (no longer primary-colored).
- `Alert`: hardcoded green/yellow/red/blue palettes replaced with the semantic tokens.
- `Toast`: redesigned as a raised neutral card with a semantic icon tile (styling
  deduplicated), and the Toaster now forces the theme font — Sonner's stylesheet
  hardcodes its own font-family, so toasts never rendered in Resist Sans.
- `Headline`/`Prose` h1: `font-bold` → `font-semibold` — headlines top out at
  semibold across the system.
- `Dialog`/`AlertDialog`: overlay is `bg-black/80` (was gray-700/75); content is an
  elevated tactile card.
- `Switch`, `Avatar`, `Tooltip`, `ActionPanel`, `Toolbar`, `EmptyState`,
  `Password`, `Select` trigger: tactile/token pass.

**Added**

- `Button`: `size="xs"` and `loading` prop (spinner + disabled).
- `Table`: `density="compact"` variant (36px muted header band, tighter cells) —
  replaces app-level CSS patches.
- New components: `Progress` (glossy fill on recessed track), `StatusBadge`
  (dot status chips: `chip`/`soft`/`plain` variants, `pulse`/`glow`),
  `SettingsCard` (+`SettingsCardRow`, `SettingsCardStatus`), `Field`.
- `@gigadrive/harmony/tailwind-preset`: shared Tailwind preset (colors incl.
  semantic tokens, radius, fonts, plugins). Replace copied app configs with
  `presets: [harmonyPreset]` + your `content` globs. This also fixes the broken
  `success: 'colors.emerald'` string literals present in copied configs.
- New Storybook foundations: `Foundations/Tokens`, `Foundations/Tactile`,
  `Foundations/Audit` (all components, light + dark).

**Migration notes**

- Forms using `label` on Input/Textarea gain vertical space (label sits above the
  field); review dense layouts.
- Remove app-level table density CSS patches in favor of `density="compact"`.
- Replace hand-rolled status pills with `StatusBadge`, local settings-card
  components with `SettingsCard`, and raw spinners inside buttons with
  `loading`.

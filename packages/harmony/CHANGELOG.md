# @gigadrive/harmony

## 4.1.0

### Minor Changes

- Add a first-party `@gigadrive/harmony/theme` entry point (`ThemeProvider` + `useTheme`) with a `next-themes`-compatible API, replacing the `next-themes` dependency. ([#310](https://github.com/Gigadrive/sdk/pull/310))

  The anti-FOUC script is injected via Next's `useServerInsertedHTML`, so it lands in the SSR `<head>` and is never part of the client React tree — eliminating React 19.2's "Encountered a script tag while rendering React component" warning while preserving FOUC prevention, class/`data-*` toggling on `<html>`, `localStorage` persistence, `system` preference resolution, cross-tab sync, and `disableTransitionOnChange`.

  Harmony's `Toaster` now consumes this provider instead of `next-themes`. `next` is declared as an optional peer dependency — only `@gigadrive/harmony/theme` requires it; the rest of the library (including `Toaster`/`useTheme`) stays framework-agnostic.

## 4.0.0

### Major Changes

- Replace `Select` with the canonical shadcn implementation. ([#306](https://github.com/Gigadrive/sdk/pull/306))

  **BREAKING:**
  - Removes the indicator `Context` and the `indicatorPosition` / `indicatorVisibility` / `indicator` props on `Select`, along with the `SelectIndicator` export. `SelectItem` now always renders the built-in right-aligned checkmark (`SelectPrimitive.ItemIndicator`); to customise the indicator, fork or wrap `SelectItem` and override that markup/styles.
  - Trigger `size` is now `sm` | `default` (previously `sm` | `md` | `lg`); the default is `default`.
  - `SelectContent` now defaults to `item-aligned` positioning (previously `popper`). Pass `position="popper"` to restore the old behaviour.

  The selected-item check indicator now renders on the right, and the component adopts shadcn's current `data-slot` styling and dynamic max-height.

  **Fix:** normalize Tailwind v4-only utilities to their Tailwind v3 equivalents across the library (harmony is pinned to Tailwind v3). These classes previously emitted no CSS, most visibly leaving a stray native focus outline — a white ring in dark mode / black in light mode — on hovered/highlighted items. Affected components: `Select`, `Popover`, `Command`, `Calendar`, `ContextMenu`, and `ButtonGroup` (`outline-hidden`→`outline-none`, `shadow-xs`→`shadow-sm`, `has-focus:`→`has-[:focus]:`, `**:`→`[&_…]`, and `foo-(--bar)`→`foo-[var(--bar)]`).

## 3.7.0

### Minor Changes

- Rewrite sidebar with iOS-style layer navigation, inset variant, SidebarInset component, and auto-fade scrollbars. Add squircle corners and Apple-style fallback to avatar. Propagate active state to parent sidebar items. Refine shine effect on UI components for subtler gloss. Fix tooltip visibility and active hover state in sidebar. Update Storybook config and dependencies. ([#285](https://github.com/Gigadrive/sdk/pull/285))

## 3.6.2

### Patch Changes

- Move misplaced dependencies: effect and @effect/platform to peerDependencies in network-config, storybook packages to devDependencies in harmony ([#272](https://github.com/Gigadrive/sdk/pull/272))

## 3.6.1

### Patch Changes

- remove gradient style from Card component ([#262](https://github.com/Gigadrive/sdk/pull/262))

## 3.6.0

### Minor Changes

- update components with improved styling ([#260](https://github.com/Gigadrive/sdk/pull/260))

## 3.5.1

### Patch Changes

- fix calendar compilation issue ([#243](https://github.com/Gigadrive/sdk/pull/243))

## 3.5.0

### Minor Changes

- add data grid and table components ([#235](https://github.com/Gigadrive/sdk/pull/235))

## 3.4.0

### Minor Changes

- make design more consistent, add new EmptyState component and fix some bugs ([#232](https://github.com/Gigadrive/sdk/pull/232))

## 3.3.1

### Patch Changes

- add slight animation when tapping the Button component ([#194](https://github.com/Gigadrive/sdk/pull/194))

## 3.3.0

### Minor Changes

- add as property to SidebarMenuItem ([#175](https://github.com/Gigadrive/sdk/pull/175))

## 3.2.2

### Patch Changes

- fix: remove invalid border style ([#154](https://github.com/Gigadrive/sdk/pull/154))

## 3.2.1

### Patch Changes

- fixed DX issues ([#147](https://github.com/Gigadrive/sdk/pull/147))

## 3.2.0

### Minor Changes

- add typography components + table of contents ([#89](https://github.com/Gigadrive/sdk/pull/89))

### Patch Changes

- remove inter-ui dependency ([#91](https://github.com/Gigadrive/sdk/pull/91))

## 3.1.0

### Minor Changes

- add toolbar component, fix display issues with sidebar and navbar ([#75](https://github.com/Gigadrive/sdk/pull/75))

## 3.0.1

### Patch Changes

- fix exports and remove barrel files for components ([#72](https://github.com/Gigadrive/sdk/pull/72))

## 3.0.0

### Major Changes

- harmony v3 ([#70](https://github.com/Gigadrive/sdk/pull/70))

# AGENTS.md — @gigadrive/harmony

React UI component library built on Radix UI primitives, Tailwind CSS, and
shadcn/ui patterns. Part of the Gigadrive SDK monorepo (`packages/harmony`).

## Build Commands

```bash
# Build the library (Rslib — unbundled ESM + CJS with DTS)
pnpm build                          # from packages/harmony

# Build all packages from repo root (Turborepo)
pnpm build                          # from repo root
pnpm build:no-cache                 # skip Turbo cache

# Clean
pnpm clean                          # removes dist/
```

## Lint & Format (run from repo root)

```bash
pnpm lint                            # ESLint check
pnpm lint:fix                        # ESLint autofix
pnpm format                          # Prettier check
pnpm format:fix                      # Prettier autofix
```

CI runs `pnpm test`, `pnpm lint`, and `pnpm format` in parallel. All must pass.

## Tests (run from repo root)

```bash
pnpm test                            # run all tests (Vitest)
pnpm test:watch                      # watch mode
pnpm test:coverage                   # with Istanbul coverage

# Single file
pnpm vitest run packages/harmony/src/lib/utils.test.ts

# By test name
pnpm vitest run -t "should compute initials"

# All tests in this package
pnpm vitest run packages/harmony/
```

- File naming: `<name>.test.ts` / `<name>.test.tsx`, co-located next to source.
- Imports: `import { describe, expect, it } from 'vitest';`
- Test files are excluded from ESLint.

## Storybook

```bash
pnpm storybook                       # dev server on port 6006
pnpm storybook:build                 # production build
pnpm storybook:build-docs            # docs-only build
```

Stories live in `stories/components/<component-name>/index.stories.tsx`.

## Project Layout

```
src/
  index.ts                           # barrel — re-exports lib, hooks, data-table
  index.css                          # main CSS entry (Tailwind + theme vars)
  theme.css / font.css               # exported standalone CSS
  components/ui/                     # all UI components (one file per component)
  hooks/                             # custom hooks (useIsMobile, useDataTable)
  lib/utils.ts                       # cn(), wrapTextNodes(), getInitials()
stories/
  components/<name>/index.stories.tsx
.storybook/                          # Storybook config (react-vite)
```

Path aliases: `@/*` maps to `src/*`, `stories/*` maps to `stories/*`.

## Code Style

### Formatting (Prettier — repo root `.prettierrc`)

- 2-space indent, no tabs.
- Single quotes, 120-char print width, ES5 trailing commas.
- Plugins auto-sort imports (`prettier-plugin-organize-imports`) and
  Tailwind classes (`prettier-plugin-tailwindcss`). Do not manually reorder.

### TypeScript

- `strictNullChecks: true`, target ES2022, module ES2022, bundler resolution.
- Use `type` imports for type-only imports: `import type { Foo } from './foo'`.
- Use `as const` for literal arrays that derive union types.
- Interfaces for component prop shapes; inline `type` aliases for small types.

### Naming Conventions

| Element            | Convention | Example                       |
| ------------------ | ---------- | ----------------------------- |
| Component files    | kebab-case | `alert-dialog.tsx`            |
| Component names    | PascalCase | `AlertDialog`, `Button`       |
| Hooks              | camelCase  | `useIsMobile`, `useDataTable` |
| Hook files         | kebab-case | `use-mobile.tsx`              |
| Utility functions  | camelCase  | `cn`, `wrapTextNodes`         |
| Types / interfaces | PascalCase | `ButtonProps`, `InputProps`   |
| CSS variables      | kebab-case | `--primary`, `--border`       |
| Story files        | kebab-case | `index.stories.tsx`           |

### Imports

- Internal imports use the `@/` alias: `import { cn } from '@/lib/utils'`.
- Cross-component: `import { buttonVariants } from '@/components/ui/button'`.
- React: `import * as React from 'react'` (namespace import pattern used throughout).
- Radix primitives: `import * as DialogPrimitive from '@radix-ui/react-dialog'`.
- Import order is auto-managed by Prettier — do not manually organize.

### Component Patterns

- Built on **Radix UI primitives** with Tailwind styling via `cn()` from `@/lib/utils`.
- Variants use **class-variance-authority** (`cva`): define a `variants` object,
  export the variants const (e.g. `buttonVariants`) alongside the component.
- Use `React.forwardRef` with explicit generic types for all interactive components:
  ```tsx
  const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, ...props }, ref) => ( ... )
  );
  Button.displayName = 'Button';
  ```
- Always set `displayName` after `forwardRef` (use Radix `displayName` when wrapping).
- Simple layout components use inline arrow syntax without `forwardRef`.
- Always merge incoming `className` via `cn(defaultClasses, className)`.
- Expose a props interface extending the appropriate HTML or Radix prop type:
  ```tsx
  export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
      VariantProps<typeof buttonVariants> { ... }
  ```
- Use `'use client'` directive only when the component uses client-only React APIs.

### Tailwind & Styling

- Theme colors use CSS custom properties: `hsl(var(--primary))`, `hsl(var(--border))`.
- Dark mode via `class` strategy (Tailwind `darkMode: ['class']`).
- Border radius tokens: `--radius` CSS variable.
- Use `tailwind-merge` (via `cn()`) to safely merge/override Tailwind classes.
- Animations: `tailwindcss-animate` plugin + custom keyframes in tailwind config.
- Font: Resist Sans Text (extends default sans stack).

### Exports

- Barrel `src/index.ts` re-exports from `./lib`, `./hooks`, and key components.
- Individual components are also available via package subpath exports:
  `@gigadrive/harmony/<component-name>`.
- CSS exports: `@gigadrive/harmony/style.css`, `/theme.css`, `/font.css`.

### Error Handling

- Guard clauses with early `throw new Error(...)` for invalid inputs.
- Catch unknown errors safely:
  ```ts
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
  }
  ```

### Functions

- Small utilities: arrow syntax (`export const fn = (...) => { }`)
- Larger / async: declaration syntax (`export function fn(...) { }`)
- Document exported functions with JSDoc (`@param`, `@returns`).

## Performance Best Practices

Follow these guidelines (derived from Vercel React Best Practices) when writing
or refactoring components. Rules are ordered by impact.

### Re-render Optimization (MEDIUM)

- **Functional `setState`** — use the callback form when updating state based on
  the current value. This prevents stale closures and keeps callback references
  stable (no need to list state in dependency arrays):

  ```tsx
  // Bad — recreates on every items change, stale closure risk
  const add = useCallback((n: Item[]) => setItems([...items, ...n]), [items]);

  // Good — stable reference, always fresh
  const add = useCallback((n: Item[]) => setItems((cur) => [...cur, ...n]), []);
  ```

- **Lazy state initialization** — pass a function to `useState` when the initial
  value is expensive to compute. Without the function form the initializer runs
  on every render:

  ```tsx
  // Bad — buildIndex() runs every render
  const [idx, setIdx] = useState(buildIndex(items));

  // Good — runs once
  const [idx, setIdx] = useState(() => buildIndex(items));
  ```

- **Narrow effect dependencies** — depend on primitives, not objects. Derive
  booleans outside the effect so it only re-runs on meaningful transitions:

  ```tsx
  // Bad — re-runs on any user field change
  useEffect(() => {
    console.log(user.id);
  }, [user]);

  // Good — re-runs only when id changes
  useEffect(() => {
    console.log(user.id);
  }, [user.id]);
  ```

- **Subscribe to derived state** — prefer `useMediaQuery('(max-width: 767px)')`
  over `useWindowWidth()` to avoid re-renders on every pixel change.
- **`startTransition` for non-urgent updates** — wrap high-frequency, non-urgent
  state updates (e.g. scroll position) in `startTransition` to keep the UI
  responsive.
- **Extract expensive work into memoized components** — use `memo()` to enable
  early returns before computation when a parent re-renders. If React Compiler
  is enabled, manual `memo()` / `useMemo()` is unnecessary.

### Rendering Performance (MEDIUM)

- **Animate SVG wrappers, not SVG elements** — browsers lack hardware
  acceleration for CSS animations on `<svg>`. Wrap in a `<div>` and animate
  that instead:

  ```tsx
  // Bad — no GPU acceleration
  <svg className="animate-spin" ...>

  // Good — GPU-accelerated
  <div className="animate-spin"><svg ...></div>
  ```

- **`content-visibility: auto`** — apply to off-screen list items for faster
  initial render. Pair with `contain-intrinsic-size`:
  ```css
  .list-item {
    content-visibility: auto;
    contain-intrinsic-size: 0 80px;
  }
  ```
- **Hoist static JSX** — extract constant JSX (especially large SVGs) to
  module-level variables so React reuses the same element across renders.
  Unnecessary if React Compiler is enabled.
- **Explicit conditional rendering** — use ternary (`count > 0 ? <X /> : null`)
  instead of `&&` when the condition can be `0` or `NaN` to avoid rendering
  falsy values.
- **Reduce SVG precision** — trim coordinates to 1 decimal place
  (`npx svgo --precision=1 --multipass icon.svg`).

### JavaScript Performance (LOW-MEDIUM)

- **Build index Maps for repeated lookups** — replace repeated `.find()` calls
  with a `Map` keyed by the lookup field (O(n) → O(1) per lookup).
- **Use `Set`/`Map` for O(1) membership checks** — convert arrays to `Set`
  before calling `.has()` in filters.
- **Combine iterations** — merge multiple `.filter()` / `.map()` passes into a
  single `for...of` loop when iterating the same array.
- **Early return** — exit functions as soon as the result is determined.
- **Hoist `RegExp`** — create regex at module scope or memoize with `useMemo()`
  instead of recreating inside render. Beware global regex mutable `lastIndex`.
- **Use `toSorted()` over `sort()`** — `.sort()` mutates the array, which breaks
  React's immutability model. Use `.toSorted()` (or `[...arr].sort()` for
  older browsers).
- **Cache property access in hot loops** — store deeply nested property values
  in a local variable before the loop.
- **Loop for min/max** — use a single-pass loop instead of `.sort()` when only
  the minimum or maximum value is needed (O(n) vs O(n log n)).
- **Cache Storage API reads** — `localStorage` / `sessionStorage` are
  synchronous and slow. Cache reads in a module-level `Map` and keep it in
  sync on writes.

### Advanced Patterns (LOW)

- **`useEffectEvent` / handler refs** — store event handlers in refs (or use
  `useEffectEvent`) when the handler is used in an effect that should not
  re-subscribe on callback changes.
- **`useLatest`** — access latest values in callbacks without adding them to
  dependency arrays to prevent effect re-runs while avoiding stale closures:
  ```tsx
  function useLatest<T>(value: T) {
    const ref = useRef(value);
    useLayoutEffect(() => {
      ref.current = value;
    }, [value]);
    return ref;
  }
  ```

### Guidance for Consumers (Next.js / App Integration)

The rules below are not directly applicable inside this library but should be
followed by **consumers** of `@gigadrive/harmony` in their applications:

- **Avoid barrel-file imports** — import individual components via subpath
  exports (`@gigadrive/harmony/button`) to avoid loading the entire library.
  Alternatively, use Next.js `optimizePackageImports`.
- **Dynamic imports for heavy components** — lazy-load large harmony components
  (e.g. data tables, rich editors) with `next/dynamic` or `React.lazy`.
- **Preload on user intent** — trigger `import()` on hover / focus to reduce
  perceived latency for dynamically loaded components.
- **Suspense boundaries** — wrap async data-dependent sections in `<Suspense>`
  to stream content and avoid blocking the entire page.
- **`Promise.all()` for parallel fetches** — never `await` independent fetches
  sequentially; use `Promise.all()` or `better-all` for partial dependencies.
- **Minimize RSC serialization** — pass only the fields a client component
  actually uses, not entire objects.
- **`React.cache()` for per-request dedup** — wrap database queries and auth
  checks so they execute only once per request.
- **SWR for client-side data** — use `useSWR` for automatic request
  deduplication, caching, and revalidation.
- **Passive event listeners** — add `{ passive: true }` to `touchstart` /
  `wheel` listeners that don't call `preventDefault()`.

## ESLint Notes

- ESLint v9 flat config at repo root.
- Type-checked rules from `typescript-eslint` enabled for `.ts` / `.tsx`.
- Several `@typescript-eslint/no-unsafe-*` rules disabled.
- React: `react-in-jsx-scope` off (JSX transform), `react-hooks/rules-of-hooks` off.
- Test files (`*.test.ts`, `*.test.tsx`) excluded entirely.
- Storybook plugin rules apply to `*.stories.*` files.

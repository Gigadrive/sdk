# AGENTS.md

This is the Gigadrive SDK monorepo — a pnpm workspace containing the CLI, shared
libraries, UI components, and build utilities for the Gigadrive Network cloud platform.

## Repository Structure

```
packages/sdk              @gigadrive/sdk                Core SDK (stub)
packages/commons          @gigadrive/commons            Shared utilities (encryption, hashing, formatting)
packages/network-config   @gigadrive/network-config     Config parsing for deployments
packages/build-utils      @gigadrive/build-utils        Build utilities (exec, file downloads, globs)
packages/cli              gigadrive                     CLI tool (Commander-based, aliases: gigadrive / gn)
packages/harmony          @gigadrive/harmony            React UI component library (Radix + Tailwind)
local/tsup                @local/tsup                   Shared tsup build configs (private)
```

## Prerequisites

- Node.js v22 (see `.nvmrc`)
- pnpm 10.28+ (corepack-managed)

## Build / Lint / Test Commands

```bash
# Build
pnpm build                # Build all packages (via Turborepo)
pnpm build:no-cache       # Build without Turbo cache
pnpm clean                # Remove all dist directories

# Lint & Format
pnpm lint                 # ESLint check
pnpm lint:fix             # ESLint autofix
pnpm format               # Prettier check
pnpm format:fix           # Prettier autofix

# Test (Vitest)
pnpm test                 # Run all tests once
pnpm test:watch           # Run in watch mode
pnpm test:coverage        # Run with Istanbul coverage

# Run a single test file
pnpm vitest run packages/commons/src/deep-merge.test.ts

# Run a single test by name
pnpm vitest run -t "should merge two objects correctly"

# Run all tests in one package
pnpm vitest run packages/commons/
```

**CI runs three parallel checks on every PR:** `pnpm test`, `pnpm lint`, `pnpm format`.
All three must pass.

## Test Conventions

- **Framework:** Vitest (v3) with Istanbul coverage.
- **File naming:** `<name>.test.ts` co-located next to the source file.
- **Imports:** Use explicit imports from `vitest`:
  ```ts
  import { describe, expect, it } from 'vitest';
  ```
- **Structure:** `describe` blocks with `it` assertions and clear descriptive names.
- **Test files are excluded from ESLint** — no lint rules apply to `*.test.ts`.

## Code Style

### Formatting (Prettier)

- 2-space indentation, no tabs
- Single quotes
- 120 character print width
- ES5 trailing commas
- Imports are auto-sorted by `prettier-plugin-organize-imports`
- Tailwind classes are auto-sorted by `prettier-plugin-tailwindcss`

### TypeScript

- **Strict mode** is enabled (`strict: true`).
- Target: ES2022, module: ES2022, moduleResolution: bundler.
- Use `type` imports for type-only imports: `import type { Foo } from './foo'`.
- Prefer `as const` assertions for literal arrays that derive union types.
- Use generics where appropriate for reusable utilities.
- Interfaces for larger object shapes; inline `type` aliases for small types.

### Naming Conventions

| Element             | Convention       | Example                        |
| ------------------- | ---------------- | ------------------------------ |
| Files               | kebab-case       | `deep-merge.ts`                |
| Functions/variables | camelCase        | `deepMerge`, `resultBuffer`    |
| Types/interfaces    | PascalCase       | `CommandInput`, `RegionConfig` |
| Constants           | UPPER_SNAKE_CASE | `AVAILABLE_REGIONS`            |
| Test files          | kebab-case       | `deep-merge.test.ts`           |
| React components    | PascalCase       | `Button.tsx`, `AlertDialog`    |

### Imports

- Relative imports within a package: `import { deepMerge } from './deep-merge'`
- Cross-package imports: `import { ... } from '@gigadrive/commons'`
- Local utilities: `import { index } from '@local/tsup'`
- Node.js built-ins: prefer `node:` prefix in new code (`import fs from 'node:fs'`)
- Import order is auto-managed by Prettier — do not manually organize.

### Functions

- Small utility functions: arrow syntax (`export const fn = (...) => { }`)
- Larger/async functions: declaration syntax (`export async function fn(...) { }`)
- Document exported functions with JSDoc (`@param`, `@returns`, `@example`).

### Error Handling

- Guard clauses with early `throw new Error(...)` for invalid inputs.
- Catch unknown errors safely:
  ```ts
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
  }
  ```
- Use bare `catch { }` (no variable) only when re-throwing with a custom message.
- In Promise constructors: `reject(new Error(...))`.

### Exports

- Each package has a barrel `index.ts` that re-exports everything:
  ```ts
  export * from './deep-merge';
  export * from './format-bytes';
  ```
- Packages output dual CJS (`.js`) + ESM (`.mjs`) via tsup with conditional exports.

## Package Build Configuration

Most packages use a shared tsup config from `@local/tsup`:

```ts
import { index } from '@local/tsup';
export default index;
```

This outputs CJS, ESM, and IIFE formats with declarations, sourcemaps, and all
dependencies marked as external.

The `harmony` UI library uses Rslib instead (unbundled ESM + CJS with DTS).

## Versioning & Publishing

- Uses **Changesets** for versioning. Add a changeset via `pnpm changeset`.
- Publishing is automated via GitHub Actions on push to `main`.
- Turbo remote caching is enabled in CI.

## ESLint Notes

- ESLint v9 flat config (`eslint.config.js`).
- Type-checked rules from `typescript-eslint` are enabled for `.ts`/`.tsx`.
- Several `@typescript-eslint/no-unsafe-*` rules are intentionally disabled.
- Test files (`*.test.ts`, `*.test.tsx`) are **excluded** from linting entirely.
- React: `react-in-jsx-scope` is off (JSX transform handles it).

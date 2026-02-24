# AGENTS.md — @gigadrive/network-config

Configuration parsing library for Gigadrive Network deployments. Handles
YAML/JSON config files (v4 schema), Vercel Build Output v3 translation, region/
runtime mapping, and schema validation via AJV. Part of the Gigadrive SDK
monorepo (`packages/network-config`).

## Build Commands

```bash
# Build the package (tsup + copy v4 schema.json to dist)
pnpm build                          # from packages/network-config

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
pnpm vitest run packages/network-config/src/parse-raw-config.test.ts

# By test name
pnpm vitest run -t "should parse a valid YAML config"

# All tests in this package
pnpm vitest run packages/network-config/
```

- File naming: `<name>.test.ts` co-located next to the source file.
- Imports: `import { describe, expect, it } from 'vitest';`
- Tests use an in-memory `FileSystem` layer (`makeTestFs` from `test-utils.ts`) for filesystem mocking.
- Test files are excluded from ESLint.

## Project Layout

```
src/
  index.ts                            # barrel — re-exports all public modules
  find-config.ts                      # locates config file in a project folder
  normalized-config.ts                # central NormalizedConfig interface + types
  parse-config.ts                     # main entry: parse + validate via AJV
  parse-raw-config.ts                 # YAML/JSON string → raw object
  filter-functions-from-assets.ts     # separates function files from static assets
  regions.ts                          # AVAILABLE_REGIONS constant + Region type
  runtime.ts                          # AVAILABLE_RUNTIMES constant + Runtime type
  build-output-v3/
    index.ts                          # Vercel Build Output v3 types
    parse.ts                          # transforms v3 output → NormalizedConfig
    translate-vercel-region.ts        # Vercel region code → Gigadrive region
    translate-vercel-runtime.ts       # Vercel runtime → Gigadrive runtime
    determine-repo-root.ts            # detects monorepo root from cwd
    read-config-file.ts              # reads gigadrive.yaml/json from disk
    get-default-path-map.ts           # default static file → route mapping
    get-monorepo-files.ts             # lists files shared across monorepo
  v4/
    index.ts                          # ConfigV4 interface definitions
    parse.ts                          # v4 config parser + normalizer
    schema.ts                         # JSON Schema as TypeScript object
    schema.json                       # JSON Schema file (copied to dist on build)
    example.yaml                      # example v4 config for reference
```

## Key Dependencies

- **ajv / ajv-formats** — JSON Schema validation for config files.
- **yaml** — YAML parsing.
- **minimatch** — glob pattern matching for asset filtering.
- **@gigadrive/commons** — shared utilities (formatting, hashing).
- **@gigadrive/build-utils** — file operations (exec, glob, downloads).

## Code Style

### Formatting (Prettier — repo root `.prettierrc`)

- 2-space indent, no tabs.
- Single quotes, 120-char print width, ES5 trailing commas.
- Plugins auto-sort imports (`prettier-plugin-organize-imports`) and
  Tailwind classes (`prettier-plugin-tailwindcss`). Do not manually reorder.

### TypeScript

- **Strict mode** is enabled (`strict: true`).
- Target: ES2022, module: ES2022, moduleResolution: bundler.
- Use `type` imports for type-only imports: `import type { Foo } from './foo'`.
- Prefer `as const` assertions for literal arrays that derive union types
  (see `AVAILABLE_REGIONS` and `AVAILABLE_RUNTIMES`).
- Interfaces for larger object shapes; inline `type` aliases for small types.

### Naming Conventions

| Element             | Convention       | Example                        |
| ------------------- | ---------------- | ------------------------------ |
| Files               | kebab-case       | `parse-raw-config.ts`          |
| Functions/variables | camelCase        | `parseRawConfig`, `configPath` |
| Types/interfaces    | PascalCase       | `NormalizedConfig`, `ConfigV4` |
| Constants           | UPPER_SNAKE_CASE | `AVAILABLE_REGIONS`            |
| Test files          | kebab-case       | `parse-raw-config.test.ts`     |

### Imports

- Relative imports within the package: `import { parseRawConfig } from './parse-raw-config'`.
- Cross-package: `import { ... } from '@gigadrive/commons'`.
- Node.js built-ins: prefer `node:` prefix (`import fs from 'node:fs'`).
- Import order is auto-managed by Prettier — do not manually organize.

### Functions

- Small utility functions: arrow syntax (`export const fn = (...) => { }`)
- Larger / async functions: declaration syntax (`export async function fn(...) { }`)
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

- Barrel `src/index.ts` re-exports all public modules:
  ```ts
  export * from './parse-config';
  export * from './normalized-config';
  ```
- Package outputs dual CJS (`.js`) + ESM (`.mjs`) via tsup with conditional exports.
- The v4 `schema.json` is copied to `dist/v4/` during build and included in the
  published package (`"files": ["dist", "**/*.json"]`).

## Build Configuration

Uses the shared tsup config from `@local/tsup`:

```ts
import { index } from '@local/tsup';
export default index;
```

This outputs CJS, ESM, and IIFE formats with declarations, sourcemaps, and all
dependencies marked as external. The build script also copies `src/v4/schema.json`
into `dist/v4/`.

## ESLint Notes

- ESLint v9 flat config at repo root (`eslint.config.js`).
- Type-checked rules from `typescript-eslint` enabled for `.ts`.
- Several `@typescript-eslint/no-unsafe-*` rules are intentionally disabled.
- Test files (`*.test.ts`) are excluded from linting entirely.

## Versioning & Publishing

- Uses **Changesets** for versioning. Add a changeset via `pnpm changeset`.
- Publishing is automated via GitHub Actions on push to `main`.

# Adding a New Framework

This guide explains how to add auto-detection support for a new web framework.
Every framework is a single TypeScript file exporting a `FrameworkDefinition`
object — no runtime logic, just data.

## Overview

```text
packages/network-config/src/detection/
  frameworks/
    index.ts          ← barrel: register your framework here
    nextjs.ts         ← example: meta-framework (high priority)
    elysia.ts         ← example: minimal server (low priority)
    laravel.ts        ← example: PHP framework (multi-detector)
    <your-framework>.ts  ← you add this
  types.ts            ← FrameworkDefinition interface
```

## Step-by-step

### 1. Create the definition file

Create `packages/network-config/src/detection/frameworks/<slug>.ts`.
The filename must be kebab-case and match the `slug` field.

```ts
import type { FrameworkDefinition } from '../types';

export const myFramework: FrameworkDefinition = {
  slug: 'my-framework',
  name: 'My Framework',
  language: 'node', // 'node' | 'php'
  detectors: [{ matchPackage: 'my-framework' }],
  priority: 50,
  getDefaultConfig: () => ({
    runtime: 'node-22',
    memory: 128,
    maxDuration: 30,
    streaming: true,
    commands: ['my-framework build'],
    entrypoint: 'dist/index.js',
    routes: [{ source: '/*', destination: 'dist/index.js' }],
    environmentVariables: { NODE_ENV: 'production' },
  }),
};
```

### 2. Register it in the barrel

Edit `packages/network-config/src/detection/frameworks/index.ts`:

```ts
import { myFramework } from './my-framework';

export const FRAMEWORK_DEFINITIONS: FrameworkDefinition[] = [
  // ... existing frameworks ...
  myFramework, // add here (order doesn't matter — the array is sorted by priority)
].sort((a, b) => b.priority - a.priority);
```

### 3. Add a test case

Add at least one test to `detect-framework.test.ts` confirming your framework
is detected:

```ts
it('should detect My Framework from package.json', async () => {
  const fs = makeTestFs({
    '/project/package.json': JSON.stringify({
      dependencies: { 'my-framework': '^1.0.0' },
    }),
  });

  const result = await Effect.runPromise(detectFramework('/project').pipe(Effect.provide(fs)));

  expect(result.framework.slug).toBe('my-framework');
});
```

### 4. Verify

```bash
pnpm vitest run packages/network-config/   # tests pass
pnpm build                                  # compiles
pnpm lint                                   # no lint errors
pnpm format:fix                             # formatting correct
```

---

## FrameworkDefinition reference

| Field              | Type                                             | Description                                                                                                       |
| ------------------ | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `slug`             | `string`                                         | Unique kebab-case identifier. Must match the filename.                                                            |
| `name`             | `string`                                         | Human-readable display name (e.g. `'Next.js'`, `'NestJS'`).                                                       |
| `language`         | `'node' \| 'php'`                                | Determines which manifest is checked (`package.json` or `composer.json`).                                         |
| `detectors`        | `FrameworkDetectionItem[]`                       | **All** items must match for the framework to be detected (AND logic).                                            |
| `priority`         | `number`                                         | Higher values are checked first. See [priority guidelines](#priority-guidelines).                                 |
| `getDefaultConfig` | `(pm: PackageManager) => FrameworkDefaultConfig` | Returns deployment defaults. The `pm` argument lets you customize install commands per package manager if needed. |

## FrameworkDefaultConfig reference

| Field                  | Type                             | Required | Description                                                                                                                                                                                                                                                                                                           |
| ---------------------- | -------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runtime`              | `Runtime`                        | yes      | The runtime to use. Available: `node-22`, `node-20`, `node-18`, `node-16`, `bun-1`, `php-84`, `php-83`, `php-81`.                                                                                                                                                                                                     |
| `memory`               | `number`                         | yes      | Memory limit in MB (e.g. `128`, `256`, `512`).                                                                                                                                                                                                                                                                        |
| `maxDuration`          | `number`                         | yes      | Max execution time in seconds (max 900).                                                                                                                                                                                                                                                                              |
| `streaming`            | `boolean`                        | yes      | Whether the function supports streaming responses. `true` for Node.js/Bun servers.                                                                                                                                                                                                                                    |
| `installCommand`       | `string`                         | no       | Overrides the auto-generated install command. Use when you need custom flags (e.g. `composer install --prefer-dist`).                                                                                                                                                                                                 |
| `commands`             | `string[]`                       | yes      | Build commands. The install command (`npm install`, `pnpm install`, etc.) is auto-prepended — do **not** include it unless the framework requires platform-specific setup (e.g., Laravel/Symfony may include explicit install commands like `composer require ...`). Use `[]` for frameworks that need no build step. |
| `entrypoint`           | `string`                         | no       | Path to the server entrypoint (relative to project root). Omit for static-only frameworks (e.g. Vite).                                                                                                                                                                                                                |
| `assetsDir`            | `string`                         | no       | Directory containing static assets to deploy to the edge.                                                                                                                                                                                                                                                             |
| `populateAssetCache`   | `boolean`                        | no       | Pre-cache assets at the edge during deployment.                                                                                                                                                                                                                                                                       |
| `routes`               | `Array<{ source, destination }>` | yes      | Route mapping. Most frameworks use `[{ source: '/*', destination: '<entrypoint>' }]`. Use `[]` for static-only projects.                                                                                                                                                                                              |
| `environmentVariables` | `Record<string, string>`         | yes      | Default env vars. Use `{}` if none needed.                                                                                                                                                                                                                                                                            |
| `symlinks`             | `Record<string, string>`         | no       | Create symlinks in the function (e.g. `{ var: '/tmp' }` for Symfony).                                                                                                                                                                                                                                                 |
| `excludeFiles`         | `string[]`                       | no       | Glob patterns for files to exclude from the function package.                                                                                                                                                                                                                                                         |

## Detectors

Detectors answer the question: "Is this project using framework X?"

Each `FrameworkDetectionItem` can specify one or more conditions. All conditions
within a single item must be true, and **all items** in the `detectors` array
must match (AND logic).

### `matchPackage`

Checks the project's dependency manifest for a package name.

- For `language: 'node'` → checks `dependencies` and `devDependencies` in `package.json`
- For `language: 'php'` → checks `require` and `require-dev` in `composer.json`

```ts
// Simple: detect if 'next' is a dependency
detectors: [{ matchPackage: 'next' }];

// PHP: detect a Composer package
detectors: [{ matchPackage: 'laravel/framework' }];
```

### `path`

Checks if a file exists at the given path (relative to project root).

```ts
// Detect Laravel: must have the package AND the artisan file
detectors: [{ matchPackage: 'laravel/framework' }, { path: 'artisan' }];
```

### `matchContent` (requires `path`)

When `path` is set, additionally checks if the file content matches a regex.

```ts
// Detect a framework by checking a config file's content
detectors: [{ path: 'config.yml', matchContent: 'framework:\\s+my-framework' }];
```

### Combining detectors

All items must match (AND). Put each independent check in its own item:

```ts
detectors: [
  { matchPackage: 'symfony/framework-bundle' }, // must have this package
  { path: 'bin/console' }, // AND this file must exist
];
```

## Priority guidelines

Priority determines evaluation order. When a project matches multiple
frameworks (e.g. a Next.js project also has `vite` as a transitive dependency),
the highest-priority match wins.

| Range  | Category                                    | Examples                                                          |
| ------ | ------------------------------------------- | ----------------------------------------------------------------- |
| 90-100 | Meta-frameworks (wrap other frameworks)     | Next.js (100), Nuxt (95), NestJS (90), Remix (90), SvelteKit (90) |
| 80-89  | Full-stack frameworks with unique structure | Astro (85), Laravel (80), Symfony (80)                            |
| 40-55  | Standalone server frameworks                | Hono (50), Elysia (45), Fastify (40)                              |
| 5-15   | Generic / commonly a transitive dependency  | Express (10), Vite (5)                                            |

Rules of thumb:

- If framework A **uses** framework B internally (NestJS uses Express), A must
  have a higher priority than B.
- If framework A is **commonly a transitive dependency** of other frameworks
  (Vite is pulled in by SvelteKit, Nuxt, Astro), give A a low priority.
- For frameworks at a similar level, use the same priority — order among equal
  priorities is undefined but deterministic (array insertion order).

## Examples

### Minimal server framework (no build step)

```ts
// frameworks/hono.ts
import type { FrameworkDefinition } from '../types';

export const hono: FrameworkDefinition = {
  slug: 'hono',
  name: 'Hono',
  language: 'node',
  detectors: [{ matchPackage: 'hono' }],
  priority: 50,
  getDefaultConfig: () => ({
    runtime: 'node-22',
    memory: 128,
    maxDuration: 30,
    streaming: true,
    commands: [], // no build needed
    entrypoint: 'src/index.ts',
    routes: [{ source: '/*', destination: 'src/index.ts' }],
    environmentVariables: { NODE_ENV: 'production' },
  }),
};
```

### Meta-framework with static assets

```ts
// frameworks/nuxt.ts
import type { FrameworkDefinition } from '../types';

export const nuxt: FrameworkDefinition = {
  slug: 'nuxt',
  name: 'Nuxt',
  language: 'node',
  detectors: [{ matchPackage: 'nuxt' }],
  priority: 95,
  getDefaultConfig: () => ({
    runtime: 'node-22',
    memory: 256,
    maxDuration: 30,
    streaming: true,
    commands: ['nuxt build'],
    entrypoint: '.output/server/index.mjs',
    assetsDir: '.output/public',
    populateAssetCache: true,
    routes: [{ source: '/*', destination: '.output/server/index.mjs' }],
    environmentVariables: { NODE_ENV: 'production', NITRO_PRESET: 'node-server' },
  }),
};
```

### PHP framework with multi-detector

```ts
// frameworks/laravel.ts
import type { FrameworkDefinition } from '../types';

export const laravel: FrameworkDefinition = {
  slug: 'laravel',
  name: 'Laravel',
  language: 'php',
  detectors: [
    { matchPackage: 'laravel/framework' }, // in composer.json require
    { path: 'artisan' }, // artisan file must exist
  ],
  priority: 80,
  getDefaultConfig: () => ({
    runtime: 'php-84',
    memory: 256,
    maxDuration: 30,
    streaming: false,
    commands: ['composer require bref/laravel-bridge --update-with-dependencies', 'bun install', 'bun run build'],
    entrypoint: 'public/index.php',
    assetsDir: 'public',
    populateAssetCache: true,
    excludeFiles: ['tests/', 'storage/', '.ddev', 'node_modules/'],
    routes: [{ source: '/*', destination: 'public/index.php' }],
    environmentVariables: {
      APP_NAME: 'Laravel',
      APP_ENV: 'production',
      APP_DEBUG: 'false',
      LOG_CHANNEL: 'stderr',
      SESSION_DRIVER: 'cookie',
    },
  }),
};
```

### Bun-native runtime

```ts
// frameworks/elysia.ts
import type { FrameworkDefinition } from '../types';

export const elysia: FrameworkDefinition = {
  slug: 'elysia',
  name: 'Elysia',
  language: 'node',
  detectors: [{ matchPackage: 'elysia' }],
  priority: 45,
  getDefaultConfig: () => ({
    runtime: 'bun-1', // Bun-native framework uses bun runtime
    memory: 128,
    maxDuration: 30,
    streaming: true,
    commands: [],
    entrypoint: 'src/index.ts',
    routes: [{ source: '/*', destination: 'src/index.ts' }],
    environmentVariables: { NODE_ENV: 'production' },
  }),
};
```

## Adding a new language

The detection system currently supports `node` and `php`. To add a new
language (e.g. `ruby`, `dotnet`, `java`):

1. Add the language to the `FrameworkLanguage` union in `types.ts`:

   ```ts
   export type FrameworkLanguage = 'node' | 'php' | 'ruby';
   ```

2. Add the manifest config in `read-dependencies.ts`:

   ```ts
   const MANIFEST_CONFIG = {
     // ...existing...
     ruby: { file: 'Gemfile', depKeys: [] }, // Ruby needs custom parsing
   };
   ```

   For non-JSON manifests (Gemfile, .csproj), you'll need to add a custom
   parser in `readDependencies` that extracts dependency names from the
   file format.

3. If the language has its own package manager, add it to `PackageManager`
   in `types.ts` and add lockfile detection in `detect-package-manager.ts`.

4. Add a test for the new manifest parsing in `read-dependencies.test.ts`.

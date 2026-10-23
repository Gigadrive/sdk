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
    rails.ts          ← example: Ruby framework (lockfile detection, asset build)
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
  language: 'node', // 'node' | 'php' | 'ruby'
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

| Field                 | Type                                                          | Description                                                                                                                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slug`                | `string`                                                      | Unique kebab-case identifier. Must match the filename.                                                                                                                                                                                                        |
| `name`                | `string`                                                      | Human-readable display name (e.g. `'Next.js'`, `'NestJS'`).                                                                                                                                                                                                   |
| `language`            | `'node' \| 'php' \| 'ruby'`                                   | Determines which manifest is checked (`package.json`, `composer.json`, or `Gemfile.lock` / `Gemfile`) and, for PHP and Ruby, the package manager.                                                                                                             |
| `detectors`           | `FrameworkDetectionItem[]`                                    | **All** items must match for the framework to be detected (AND logic).                                                                                                                                                                                        |
| `priority`            | `number`                                                      | Higher values are checked first. See [priority guidelines](#priority-guidelines).                                                                                                                                                                             |
| `getDefaultConfig`    | `(pm: PackageManager) => FrameworkDefaultConfig`              | Returns deployment defaults. The `pm` argument lets you customize install commands per package manager if needed.                                                                                                                                             |
| `refineDefaultConfig` | `(defaults, projectFolder) => Effect<FrameworkDefaultConfig>` | Optional. Refines defaults using project files after a match — e.g. NestJS reads `nest-cli.json`, and the minimal server frameworks resolve the entrypoint via `resolveNodeServerEntrypoint` (`package.json` `main` → `start` script → common files on disk). |

## FrameworkDefaultConfig reference

| Field                   | Type                             | Required | Description                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------- | -------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runtime`               | `Runtime`                        | yes      | The runtime to use. Available: `node-22`, `node-20`, `node-18`, `node-16`, `bun-1`, `php-84`, `php-83`, `php-81`, `ruby-40`, `ruby-34`, `ruby-33`.                                                                                                                                                                                                                    |
| `memory`                | `number`                         | yes      | Memory limit in MB (e.g. `128`, `256`, `512`).                                                                                                                                                                                                                                                                                                                        |
| `maxDuration`           | `number`                         | yes      | Maximum invocation lifetime in seconds (max 28,800 / eight hours). Applies to HTTP requests, response streams, and WebSocket connections.                                                                                                                                                                                                                             |
| `streaming`             | `boolean`                        | yes      | Whether the function supports streaming responses. `true` for Node.js/Bun servers.                                                                                                                                                                                                                                                                                    |
| `installCommand`        | `string`                         | no       | Overrides the auto-generated install command. Use when you need custom flags (e.g. `composer install --prefer-dist`).                                                                                                                                                                                                                                                 |
| `commands`              | `string[]`                       | yes      | Build commands. The install command (`npm install`, `pnpm install`, etc.) is auto-prepended — do **not** include it unless the framework requires platform-specific setup (e.g., Laravel/Symfony may include explicit install commands like `composer require ...`). Use `[]` for frameworks that need no build step.                                                 |
| `entrypoint`            | `string`                         | no       | Path to the server entrypoint (relative to project root). Omit for static-only frameworks (e.g. Vite).                                                                                                                                                                                                                                                                |
| `assetsDir`             | `string`                         | no       | Build output directory to publish to the edge. Every file inside it is enumerated after the customer build and served with the directory prefix stripped, so `dist/assets/app.js` answers `/assets/app.js`. When the framework produces no entrypoint and no routes, directory index files also answer their extensionless path (`dist/about/index.html` → `/about`). |
| `populateAssetCache`    | `boolean`                        | no       | Pre-cache assets at the edge during deployment.                                                                                                                                                                                                                                                                                                                       |
| `routes`                | `Array<{ source, destination }>` | yes      | Route mapping. Most frameworks use `[{ source: '/*', destination: '<entrypoint>' }]`. Use `[]` for static-only projects.                                                                                                                                                                                                                                              |
| `environmentVariables`  | `Record<string, string>`         | yes      | Default env vars. Use `{}` if none needed.                                                                                                                                                                                                                                                                                                                            |
| `symlinks`              | `Record<string, string>`         | no       | Create symlinks in the function. Targets must stay inside the project; for directories the framework writes to at runtime use `package.writablePaths`.                                                                                                                                                                                                                |
| `package.writablePaths` | `string[]`                       | no       | Directories the function writes to at runtime (cache, sessions, logs). The platform creates each one and makes it writable by the runtime user; writes are private to one running copy and lost when it stops. PHP presets build these with `phpFrontControllerDefaults`.                                                                                             |
| `excludeFiles`          | `string[]`                       | no       | Glob patterns for files to exclude from the function package.                                                                                                                                                                                                                                                                                                         |

## PHP runtime selection

Every PHP preset (`language: 'php'`) picks its runtime from the project's
`composer.json` `require.php` constraint. `FRAMEWORK_DEFINITIONS` wraps each
one with `withComposerPhpRuntime` (`frameworks/php-runtime.ts`), which runs
after the preset's own `refineDefaultConfig`, so a new PHP preset gets this
without extra code: declare `runtime: 'php-84'` as its default.

The newest PHP runtime whose newest patch release the constraint allows wins:
`^8.2` → `php-84`, `~8.3.0` or `>=8.1 <8.4` → `php-83`. A missing or
unparseable constraint, or one allowing neither 8.4 nor 8.3, keeps the
preset's default. `php-81` is deprecated and never picked. Constraints are
evaluated by the dependency-free `composerConstraintAllows`
(`frameworks/composer-constraint.ts`).

## Ruby presets

Ruby presets (`language: 'ruby'`) always install with Bundler: the detected
package manager is `bundler` and `bundle install` is prepended to the build
commands, whatever Node or Composer lockfiles the project also carries. The
command takes no flags; the build sets `BUNDLE_PATH`, `BUNDLE_WITHOUT` and
`BUNDLE_DEPLOYMENT` through the environment. A Node framework never installs
with Bundler, even when the project keeps a Gemfile (for Fastlane, say).

### Manifest

`matchPackage` checks the gems in `Gemfile.lock`: every name in the `specs:`
lists of its `GEM`, `GIT` and `PATH` sections, so transitive gems count too
(`railties` for any Rails application). Without a lockfile it checks the
`gem "name"` declarations of the `Gemfile`, which lists direct dependencies
only; Rails and Jekyll therefore also have a variant for the gem a `Gemfile`
names (`rails`, `github-pages`). Missing files mean an empty set, never an
error.

### Server presets and the launcher

A server preset's `entrypoint` is the Rack file the platform's launcher runs,
normally `config.ru`. The launcher treats an entrypoint ending in `.ru` as a
rackup file and one ending in `.rb` as a classic Sinatra-style script (it
requires the file and runs `Sinatra::Application`), which is why the Sinatra
preset falls back to `app.rb`, `main.rb`, `server.rb` or `application.rb`
without a `config.ru`. Build server defaults with `rubyServerDefaults`
(`frameworks/ruby-server.ts`): every request reaches the entrypoint through a
`/*` streaming route, since it is proxied to a real server, and `public/` is
published as static assets with `populateAssetCache`. Use
`refineRubyPublicDirectory` (directly or from your own `refineDefaultConfig`)
to drop `assetsDir` when the project has no `public/` directory.

Static assets of a Ruby preset never include dotfiles, `.rb` or `.ru` files,
Bundler manifests (`Gemfile`, `Gemfile.lock`, `gems.rb`, `gems.locked`) or
anything under the project's `vendor/` directory, even when the asset
directory is the project root.

Static site generators (Jekyll, Bridgetown) have no entrypoint and no routes:
their build output is the deployment. Their `runtime` still picks the Ruby the
build runs on. It appears nowhere in the generated config, so a build reads it
with `detectRubyRuntime(projectFolder)`.

Secrets such as Rails' `SECRET_KEY_BASE` use `generatedSecret('hex')`; the
platform supports only the `laravel-app-key` and `hex` formats.

### Ruby runtime selection

Every Ruby preset picks its runtime from the Ruby version the project names.
`FRAMEWORK_DEFINITIONS` wraps each one with `withRubyRuntime`
(`frameworks/ruby-runtime.ts`), which runs after the preset's own
`refineDefaultConfig`, so a new Ruby preset gets this without extra code:
declare `runtime: 'ruby-34'` (`DEFAULT_RUBY_RUNTIME`) as its default. Ruby 3.4
is the default rather than 4.0 because more gems support it.

The first of these sources that names a usable version wins:

1. `.ruby-version`: `3.3.6`, `ruby-3.3.6`, `3.3`. Trailing whitespace and
   anything after a space are ignored.
2. `.tool-versions`: `ruby 3.3.6`.
3. The Gemfile `ruby` directive: `ruby "3.3.6"`, `ruby "~> 3.3"`,
   `ruby ">= 3.2", "< 4.0"`, or `ruby file: ".ruby-version"`, which reads that
   file.
4. The `RUBY VERSION` section of `Gemfile.lock`: `ruby 3.3.6p108`.

A concrete version picks the runtime of its minor series (`3.3.6` →
`ruby-33`). One older than every runtime picks the oldest, `ruby-33`
(`3.2.2` → `ruby-33`), and one newer than every runtime picks `ruby-40`. A
requirement picks the newest runtime whose newest patch release it allows,
with `Gem::Requirement` semantics: `~> 3.3` (`>= 3.3, < 4.0`) → `ruby-34`,
`~> 3.3.1` (`>= 3.3.1, < 3.4`) → `ruby-33`, `>= 3.2` → `ruby-40`. A source
that names no usable version (`jruby-9.4.5.0`, `ruby RUBY_VERSION`, or a
requirement no runtime satisfies) is skipped, and without any the preset keeps
its default. Versions and requirements are parsed by the dependency-free
`frameworks/ruby-requirement.ts`.

## Detectors

Detectors answer the question: "Is this project using framework X?"

Each `FrameworkDetectionItem` can specify one or more conditions. All conditions
within a single item must be true, and **all items** in the `detectors` array
must match (AND logic).

### `matchPackage`

Checks the project's dependency manifest for a package name.

- For `language: 'node'` → checks `dependencies` and `devDependencies` in `package.json`
- For `language: 'php'` → checks `require` and `require-dev` in `composer.json`
- For `language: 'ruby'` → checks the gems `Gemfile.lock` resolved (including transitive ones), or the gems the `Gemfile` declares when there is no lockfile

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

| Range  | Category                                    | Examples                                                                                                  |
| ------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 90-100 | Meta-frameworks (wrap other frameworks)     | Next.js (100), Nuxt (95), NestJS (90), Remix (90), SvelteKit (90)                                         |
| 80-89  | Full-stack frameworks with unique structure | Astro (85), Laravel (80), Symfony (80), CakePHP, CodeIgniter, Laminas MVC, Mezzio, Yii 2 (80), Rails (80) |
| 70-79  | Micro-frameworks sharing another's layout   | Slim (75), Hanami (75), Jekyll (70), Bridgetown (70)                                                      |
| 40-60  | Standalone server frameworks                | Sinatra (60), Roda (60), Hono (50), Elysia (45), Fastify (40)                                             |
| 5-15   | Generic / commonly a transitive dependency  | Express (10), Rack (10), generic PHP (7), plain PHP files (6), Vite (5)                                   |

Rules of thumb:

- If framework A **uses** framework B internally (NestJS uses Express), A must
  have a higher priority than B.
- If framework A is **commonly a transitive dependency** of other frameworks
  (Vite is pulled in by SvelteKit, Nuxt, Astro), give A a low priority.
- Ruby: Rails outranks every other Ruby preset, since a Rails application's
  lockfile can list Sinatra or Roda through other gems, and Bridgetown outranks
  Roda, which it ships with. The generic Rack preset (`config.ru` and a
  `Gemfile`) ranks last and catches Grape and plain Rack applications; a
  Padrino application lists Sinatra and is detected as Sinatra.
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

The detection system currently supports `node`, `php` and `ruby`. To add a
new language (e.g. `dotnet`, `java`):

1. Add the language to the `FrameworkLanguage` union in `types.ts`:

   ```ts
   export type FrameworkLanguage = 'node' | 'php' | 'ruby' | 'dotnet';
   ```

2. Add the manifest config in `read-dependencies.ts`:

   ```ts
   const MANIFEST_CONFIG = {
     // ...existing...
     dotnet: { file: 'packages.lock.json', depKeys: ['dependencies'] },
   };
   ```

   For non-JSON manifests (a `.csproj`), add a custom parser in
   `readDependencies` that extracts dependency names from the file format, the
   way `readGemNames` parses `Gemfile.lock` and `Gemfile`.

3. If the language has its own package manager, add it to `PackageManager`
   in `types.ts`, add lockfile detection in `detect-package-manager.ts`, its
   install command in `generate-config.ts`, and force it for the language in
   `packageManagerForLanguage` (`detect-framework.ts`).

4. Add a test for the new manifest parsing in `read-dependencies.test.ts`.

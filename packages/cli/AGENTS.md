# CLI Package — AGENTS.md

This package is the `gigadrive` CLI tool, built entirely with **Effect-TS** and
**@effect/cli**. Every side effect — HTTP requests, file I/O, OAuth flows,
process execution — flows through the Effect runtime for end-to-end type safety,
structured error handling, and composable dependency injection.

## Quick Reference

```text
packages/cli/
  src/
    index.ts                    # Entry point — CLI wiring + layer composition
    domain.ts                   # Branded types + domain schemas
    errors.ts                   # All error types (Schema.TaggedError)
    services/
      oauth-config.ts           # OAuthConfigService — OIDC discovery + env config
      auth-storage.ts           # AuthStorageService — ~/.gigadrive/auth.json persistence
      auth.ts                   # AuthService — login, logout, token refresh, user info
      project-config.ts         # ProjectConfigService — gigadrive.yaml resolution
      package-manager.ts        # PackageManagerService — detect npm/yarn/pnpm/bun
      archive.ts                # ArchiveService — zip archive creation
      deployment-api.ts         # DeploymentApiService — deployment API client
    commands/
      login/index.ts            # `gigadrive login`
      whoami/index.ts           # `gigadrive whoami`
      build/index.ts            # `gigadrive build`
      debug/index.ts            # `gigadrive debug` (parent)
      debug/config/index.ts     # `gigadrive debug config`
      platform/index.ts         # `gigadrive platform` (parent)
      platform/deploy/index.ts  # `gigadrive platform deploy`
```

## Architecture Overview

### Effect-TS Fundamentals

The CLI is structured around these Effect concepts:

| Concept                                 | Usage                                                                |
| --------------------------------------- | -------------------------------------------------------------------- |
| `Effect.Service`                        | All business logic lives in service classes with `accessors: true`   |
| `Schema.TaggedError`                    | Every distinct failure has its own error type in `errors.ts`         |
| `Schema.brand`                          | Entity IDs (`DeploymentId`, `ApplicationId`, `UploadId`) are branded |
| `Config.*`                              | Environment variables are read via `Config.string()` with defaults   |
| `Effect.log`                            | All logging uses structured `Effect.log` (no `console.log`)          |
| `Layer.mergeAll` + `Layer.provideMerge` | Services are composed at the app root                                |
| `@effect/cli` `Command`                 | CLI commands use `Command.make` with typed args/options              |

### Dependency Graph

```text
AuthService
  ├── OAuthConfigService (OIDC discovery, env config)
  └── AuthStorageService (file-based token persistence)

ProjectConfigService     (standalone — wraps @gigadrive/network-config)
PackageManagerService    (standalone — detects npm/yarn/pnpm/bun)
ArchiveService           (standalone — zip creation with ignore rules)
DeploymentApiService     (standalone — HTTP API client)
```

All layers are composed flat in `src/index.ts`:

```ts
const ServicesLive = Layer.mergeAll(
  OAuthConfigService.Default,
  AuthStorageService.Default,
  ProjectConfigService.Default,
  PackageManagerService.Default,
  ArchiveService.Default,
  DeploymentApiService.Default
).pipe(Layer.provideMerge(AuthService.Default));

const AppLive = Layer.mergeAll(ServicesLive, NodeContext.layer, Logger.minimumLogLevel(LogLevel.Info));
```

## Best Practices Enforced in This Package

### 1. Services: Always Use `Effect.Service`

```ts
// CORRECT — Effect.Service with accessors
export class MyService extends Effect.Service<MyService>()('MyService', {
  accessors: true,
  dependencies: [OtherService.Default],
  effect: Effect.gen(function* () {
    const other = yield* OtherService;
    const myMethod = Effect.gen(function* () {
      /* ... */
    });
    return { myMethod };
  }),
}) {}

// WRONG — singleton class instance
export const myService = new MyService();
```

### 2. Errors: Always Use `Schema.TaggedError`

Every distinct failure reason gets its own error type. Never use generic errors.

```ts
// CORRECT — specific, descriptive error types
export class ConfigNotFoundError extends Schema.TaggedError<ConfigNotFoundError>()('ConfigNotFoundError', {
  message: Schema.String,
  directory: Schema.String,
}) {}

// WRONG — generic error
throw new Error('Config not found');
```

All error types live in `src/errors.ts`. Error handling uses `catchTag`/`catchTags`:

```ts
yield *
  effect.pipe(
    Effect.catchTags({
      ConfigNotFoundError: (err) => Console.error(err.message),
      ConfigParseError: (err) => Console.error(`Parse error: ${err.message}`),
    })
  );
```

### 3. Branded Types for Entity IDs

```ts
export const DeploymentId = Schema.String.pipe(Schema.brand('@Gigadrive/DeploymentId'));
export type DeploymentId = Schema.Schema.Type<typeof DeploymentId>;
```

This prevents accidentally passing an `ApplicationId` where a `DeploymentId` is
expected. All entity IDs are defined in `src/domain.ts`.

### 4. Config: Use `Config.*` Instead of `process.env`

```ts
// CORRECT — validated, typed config
const ApiBaseUrl = Config.string('GIGADRIVE_API_BASE_URL').pipe(Config.withDefault('http://localhost:3000'));

// WRONG — direct env access
const url = process.env.GIGADRIVE_API_BASE_URL;
```

### 5. Logging: Use `Effect.log` Instead of `console.log`

```ts
// CORRECT — structured logging through Effect
yield * Effect.log('Creating deployment', { applicationId, region });
yield * Effect.logWarning('Deprecated config option used');

// WRONG — direct console output
console.log('Creating deployment');
```

For user-facing output in command handlers, use `Console.log` / `Console.error`
from `effect` (these are Effect-aware).

### 6. CLI Commands with `@effect/cli`

Commands are defined with `Command.make` from `@effect/cli`:

```ts
import { Args, Command, Options } from '@effect/cli';
import { Console, Effect } from 'effect';

export const myCommand = Command.make('my-command', { verbose }, ({ verbose }) =>
  Effect.gen(function* () {
    const service = yield* MyService;
    yield* service.doSomething;
    yield* Console.log('Done!');
  }).pipe(
    Effect.catchTags({
      MyError: (err) => Console.error(err.message),
    })
  )
);
```

Subcommands are composed with `Command.withSubcommands`:

```ts
const parentCommand = Command.make('parent', {}, () => Effect.void).pipe(
  Command.withSubcommands([childCommand1, childCommand2])
);
```

### 7. Layer Composition

- Use `Layer.mergeAll` for same-level, independent services
- Use `Layer.provideMerge` when one layer depends on another
- Declare `dependencies` in the service definition, not at usage sites
- Compose all layers at the app root in `src/index.ts`

```ts
// CORRECT — dependencies declared in service
export class AuthService extends Effect.Service<AuthService>()('AuthService', {
  dependencies: [OAuthConfigService.Default, AuthStorageService.Default],
  // ...
}) {}

// WRONG — providing layers at every call site
yield * myEffect.pipe(Effect.provide(AuthService.Default));
```

### 8. Effect.fn vs Plain Effect.gen

Use `Effect.fn("name")` for **service methods that take arguments** — it provides
automatic tracing with span names:

```ts
const detect = Effect.fn('PackageManagerService.detect')(function* (cwd: string) {
  yield* Effect.annotateCurrentSpan('cwd', cwd);
  // ...
});
```

Use plain `Effect.gen` for **service methods that take no arguments** — they
become plain Effects that can be `yield*`-ed directly:

```ts
const login = Effect.gen(function* () {
  // ...
});
```

### 9. Option Handling

Use `Option.match` with explicit handlers for both cases:

```ts
// CORRECT
yield *
  Option.match(stored, {
    onNone: () => Effect.fail(new TokenRefreshError({ message: 'No refresh token' })),
    onSome: (data) => Effect.succeed(data),
  });

// WRONG
const data = Option.getOrThrow(stored);
```

## Anti-Patterns (Forbidden)

| Pattern                               | Replacement                                      |
| ------------------------------------- | ------------------------------------------------ |
| `console.log(...)`                    | `Effect.log(...)` or `Console.log(...)`          |
| `process.env.X`                       | `Config.string('X')`                             |
| `throw new Error(...)`                | `Effect.fail(new SpecificError(...))`            |
| `Effect.runSync(...)` inside services | Keep everything in the Effect pipeline           |
| `catchAll(() => generic)`             | `catchTag`/`catchTags` for specific handling     |
| `null`/`undefined` in domain types    | `Option<T>`                                      |
| Singleton class instances             | `Effect.Service` with layers                     |
| `process.exit(1)` in handlers         | `Effect.fail(...)` — let the runtime handle exit |

## Adding a New Command

1. Create `src/commands/<name>/index.ts`
2. Define the command with `Command.make`:
   ```ts
   export const myCommand = Command.make(
     'my-command',
     {
       /* args/options */
     },
     (config) =>
       Effect.gen(function* () {
         // command handler
       }).pipe(
         Effect.catchTags({
           /* error handlers */
         })
       )
   );
   ```
3. Register it in `src/index.ts` via `Command.withSubcommands`
4. If your command needs a new service, create it in `src/services/`

## Adding a New Service

1. Create `src/services/<name>.ts`
2. Define the service with `Effect.Service`:
   ```ts
   export class MyService extends Effect.Service<MyService>()('MyService', {
     accessors: true,
     dependencies: [
       /* other services */
     ],
     effect: Effect.gen(function* () {
       // ...
       return { method1, method2 };
     }),
   }) {}
   ```
3. Add any new error types to `src/errors.ts`
4. Add any new domain types/schemas to `src/domain.ts`
5. Add `MyService.Default` to the layer composition in `src/index.ts`

## Adding a New Error Type

1. Add to `src/errors.ts`:
   ```ts
   export class MySpecificError extends Schema.TaggedError<MySpecificError>()('MySpecificError', {
     message: Schema.String /* additional fields */,
   }) {}
   ```
2. Handle it with `catchTag`/`catchTags` in the appropriate command handler
3. Keep errors **specific** — prefer `UserNotFoundError` over `NotFoundError`

## Environment Variables

| Variable                             | Default                    | Description             |
| ------------------------------------ | -------------------------- | ----------------------- |
| `GIGADRIVE_NETWORK_OAUTH_ISSUER_URL` | `https://idp.gigadrive.de` | OIDC issuer URL         |
| `GIGADRIVE_NETWORK_OAUTH_CLIENT_ID`  | `todo_add_client_id`       | OAuth client ID         |
| `GIGADRIVE_API_BASE_URL`             | `http://localhost:3000`    | Deployment API base URL |

All read via `Config.string()` with defaults — never accessed via `process.env`.

## Build & Test

```bash
pnpm build --filter gigadrive    # Build with tsup
pnpm lint                        # ESLint check
pnpm format                      # Prettier check
pnpm test                        # Run all tests
```

## Effect Language Server

The `@effect/language-service` plugin is configured in `tsconfig.json`. It
provides Effect-specific diagnostics, hover info, and refactors. Ensure your
editor uses the workspace TypeScript version:

- **VSCode**: F1 -> "TypeScript: Select TypeScript Version" -> "Use Workspace Version"
- **JetBrains**: Settings -> Languages & Frameworks -> TypeScript -> Use workspace version

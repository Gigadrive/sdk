import { FileSystem, Path } from '@effect/platform';
import { NodeContext } from '@effect/platform-node';
import { Effect, Layer, Logger, LogLevel } from 'effect';
import { describe, expect, it } from 'vitest';
import { PackageManagerService } from './package-manager';

// ---------------------------------------------------------------------------
// Pure function tests — installCommand / buildCommand
// ---------------------------------------------------------------------------

describe('PackageManagerService.installCommand', () => {
  const TestLayer = Layer.mergeAll(PackageManagerService.Default, Logger.minimumLogLevel(LogLevel.None)).pipe(
    Layer.provideMerge(NodeContext.layer)
  );

  const runEffect = <A, E>(effect: Effect.Effect<A, E, PackageManagerService>) =>
    Effect.runPromise(Effect.provide(effect, TestLayer));

  it('should return "npm install" for npm', async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const pm = yield* PackageManagerService;
        return pm.installCommand('npm');
      })
    );
    expect(result).toBe('npm install');
  });

  it('should return "yarn install" for yarn', async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const pm = yield* PackageManagerService;
        return pm.installCommand('yarn');
      })
    );
    expect(result).toBe('yarn install');
  });

  it('should return "pnpm install" for pnpm', async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const pm = yield* PackageManagerService;
        return pm.installCommand('pnpm');
      })
    );
    expect(result).toBe('pnpm install');
  });

  it('should return "bun install" for bun', async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const pm = yield* PackageManagerService;
        return pm.installCommand('bun');
      })
    );
    expect(result).toBe('bun install');
  });
});

describe('PackageManagerService.buildCommand', () => {
  const TestLayer = Layer.mergeAll(PackageManagerService.Default, Logger.minimumLogLevel(LogLevel.None)).pipe(
    Layer.provideMerge(NodeContext.layer)
  );

  const runEffect = <A, E>(effect: Effect.Effect<A, E, PackageManagerService>) =>
    Effect.runPromise(Effect.provide(effect, TestLayer));

  it('should return "npm run build" for npm', async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const pm = yield* PackageManagerService;
        return pm.buildCommand('npm');
      })
    );
    expect(result).toBe('npm run build');
  });

  it('should return "yarn build" for yarn', async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const pm = yield* PackageManagerService;
        return pm.buildCommand('yarn');
      })
    );
    expect(result).toBe('yarn build');
  });

  it('should return "pnpm build" for pnpm', async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const pm = yield* PackageManagerService;
        return pm.buildCommand('pnpm');
      })
    );
    expect(result).toBe('pnpm build');
  });

  it('should return "bun run build" for bun', async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const pm = yield* PackageManagerService;
        return pm.buildCommand('bun');
      })
    );
    expect(result).toBe('bun run build');
  });
});

// ---------------------------------------------------------------------------
// detect — with mocked FileSystem
// ---------------------------------------------------------------------------

describe('PackageManagerService.detect', () => {
  const makeMockFileSystem = (existingFiles: Set<string>): FileSystem.FileSystem =>
    ({
      exists: (path: string) => Effect.succeed(existingFiles.has(path)),
    }) as unknown as FileSystem.FileSystem;

  const mockPath: Path.Path = {
    join: (...segments: string[]) => segments.join('/'),
  } as unknown as Path.Path;

  const makeTestLayer = (existingFiles: Set<string>) => {
    const platformLayer = Layer.mergeAll(
      Layer.succeed(FileSystem.FileSystem, makeMockFileSystem(existingFiles)),
      Layer.succeed(Path.Path, mockPath)
    );

    return Layer.provide(PackageManagerService.Default, platformLayer).pipe(
      Layer.provideMerge(Logger.minimumLogLevel(LogLevel.None))
    );
  };

  it('should fail with PackageManagerNotFoundError when no package.json exists', async () => {
    const testLayer = makeTestLayer(new Set());

    const result = await Effect.runPromise(
      Effect.provide(PackageManagerService.detect('/project'), testLayer).pipe(
        Effect.catchTag('PackageManagerNotFoundError', (err) =>
          Effect.succeed({ _tag: 'caught' as const, message: err.message })
        )
      )
    );

    expect(result).toMatchObject({ _tag: 'caught', message: 'No package.json found' });
  });

  it('should detect yarn from yarn.lock', async () => {
    const testLayer = makeTestLayer(new Set(['/project/package.json', '/project/yarn.lock']));

    const result = await Effect.runPromise(Effect.provide(PackageManagerService.detect('/project'), testLayer));

    expect(result).toBe('yarn');
  });

  it('should detect pnpm from pnpm-lock.yaml', async () => {
    const testLayer = makeTestLayer(new Set(['/project/package.json', '/project/pnpm-lock.yaml']));

    const result = await Effect.runPromise(Effect.provide(PackageManagerService.detect('/project'), testLayer));

    expect(result).toBe('pnpm');
  });

  it('should detect bun from bun.lockb', async () => {
    const testLayer = makeTestLayer(new Set(['/project/package.json', '/project/bun.lockb']));

    const result = await Effect.runPromise(Effect.provide(PackageManagerService.detect('/project'), testLayer));

    expect(result).toBe('bun');
  });

  it('should detect npm from package-lock.json', async () => {
    const testLayer = makeTestLayer(new Set(['/project/package.json', '/project/package-lock.json']));

    const result = await Effect.runPromise(Effect.provide(PackageManagerService.detect('/project'), testLayer));

    expect(result).toBe('npm');
  });

  it('should prefer yarn.lock over other lock files', async () => {
    const testLayer = makeTestLayer(
      new Set(['/project/package.json', '/project/yarn.lock', '/project/pnpm-lock.yaml', '/project/package-lock.json'])
    );

    const result = await Effect.runPromise(Effect.provide(PackageManagerService.detect('/project'), testLayer));

    expect(result).toBe('yarn');
  });

  it('should prefer pnpm-lock.yaml over bun.lockb and package-lock.json', async () => {
    const testLayer = makeTestLayer(
      new Set(['/project/package.json', '/project/pnpm-lock.yaml', '/project/bun.lockb', '/project/package-lock.json'])
    );

    const result = await Effect.runPromise(Effect.provide(PackageManagerService.detect('/project'), testLayer));

    expect(result).toBe('pnpm');
  });
});

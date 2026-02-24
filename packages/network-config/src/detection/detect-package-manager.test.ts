import { FileSystem } from '@effect/platform';
import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import { detectPackageManager } from './detect-package-manager';

const makeTestFs = (existingFiles: string[]) =>
  Layer.succeed(FileSystem.FileSystem, {
    exists: (path: string) => Effect.succeed(existingFiles.includes(path)),
  } as unknown as FileSystem.FileSystem);

describe('detectPackageManager', () => {
  it('should detect bun from bun.lockb', async () => {
    const fs = makeTestFs(['/project/bun.lockb']);
    const result = await Effect.runPromise(detectPackageManager('/project').pipe(Effect.provide(fs)));
    expect(result).toBe('bun');
  });

  it('should detect bun from bun.lock', async () => {
    const fs = makeTestFs(['/project/bun.lock']);
    const result = await Effect.runPromise(detectPackageManager('/project').pipe(Effect.provide(fs)));
    expect(result).toBe('bun');
  });

  it('should detect pnpm from pnpm-lock.yaml', async () => {
    const fs = makeTestFs(['/project/pnpm-lock.yaml']);
    const result = await Effect.runPromise(detectPackageManager('/project').pipe(Effect.provide(fs)));
    expect(result).toBe('pnpm');
  });

  it('should detect yarn from yarn.lock', async () => {
    const fs = makeTestFs(['/project/yarn.lock']);
    const result = await Effect.runPromise(detectPackageManager('/project').pipe(Effect.provide(fs)));
    expect(result).toBe('yarn');
  });

  it('should detect npm from package-lock.json', async () => {
    const fs = makeTestFs(['/project/package-lock.json']);
    const result = await Effect.runPromise(detectPackageManager('/project').pipe(Effect.provide(fs)));
    expect(result).toBe('npm');
  });

  it('should detect composer from composer.lock', async () => {
    const fs = makeTestFs(['/project/composer.lock']);
    const result = await Effect.runPromise(detectPackageManager('/project').pipe(Effect.provide(fs)));
    expect(result).toBe('composer');
  });

  it('should fallback to npm when no lockfile is found', async () => {
    const fs = makeTestFs([]);
    const result = await Effect.runPromise(detectPackageManager('/project').pipe(Effect.provide(fs)));
    expect(result).toBe('npm');
  });

  it('should prefer bun over pnpm when both lockfiles exist', async () => {
    const fs = makeTestFs(['/project/bun.lockb', '/project/pnpm-lock.yaml']);
    const result = await Effect.runPromise(detectPackageManager('/project').pipe(Effect.provide(fs)));
    expect(result).toBe('bun');
  });
});

import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import { makeTestFs, TestPathLayer } from '../test-utils';
import { detectPackageManager } from './detect-package-manager';

const run = (files: Record<string, string>) => {
  const layer = Layer.merge(makeTestFs(files), TestPathLayer);
  return Effect.runPromise(detectPackageManager('/project').pipe(Effect.provide(layer)));
};

describe('detectPackageManager', () => {
  it('should detect bun from bun.lockb', async () => {
    const result = await run({ '/project/bun.lockb': '' });
    expect(result).toBe('bun');
  });

  it('should detect bun from bun.lock', async () => {
    const result = await run({ '/project/bun.lock': '' });
    expect(result).toBe('bun');
  });

  it('should detect pnpm from pnpm-lock.yaml', async () => {
    const result = await run({ '/project/pnpm-lock.yaml': '' });
    expect(result).toBe('pnpm');
  });

  it('should detect yarn from yarn.lock', async () => {
    const result = await run({ '/project/yarn.lock': '' });
    expect(result).toBe('yarn');
  });

  it('should detect npm from package-lock.json', async () => {
    const result = await run({ '/project/package-lock.json': '' });
    expect(result).toBe('npm');
  });

  it('should detect composer from composer.lock', async () => {
    const result = await run({ '/project/composer.lock': '' });
    expect(result).toBe('composer');
  });

  it('should fallback to npm when no lockfile is found', async () => {
    const result = await run({});
    expect(result).toBe('npm');
  });

  it('should prefer bun over pnpm when both lockfiles exist', async () => {
    const result = await run({ '/project/bun.lockb': '', '/project/pnpm-lock.yaml': '' });
    expect(result).toBe('bun');
  });
});

import { Effect, Layer } from 'effect';
import { expect, it } from 'vitest';
import { makeTestFs, TestPathLayer } from '../../test-utils';
import { detectFramework } from '../detect-framework';
import type { PackageManager } from '../types';

export const packageJson = (dependencies: Record<string, string>) => JSON.stringify({ dependencies });

export const composerJson = (requires: Record<string, string>) => JSON.stringify({ require: requires });

export const nodePackageManagerCases: Array<{
  name: string;
  packageManager: Exclude<PackageManager, 'composer'>;
  lockfile: Record<string, string>;
  installCommand: string;
}> = [
  { name: 'npm', packageManager: 'npm', lockfile: { '/project/package-lock.json': '' }, installCommand: 'npm install' },
  { name: 'pnpm', packageManager: 'pnpm', lockfile: { '/project/pnpm-lock.yaml': '' }, installCommand: 'pnpm install' },
  { name: 'yarn', packageManager: 'yarn', lockfile: { '/project/yarn.lock': '' }, installCommand: 'yarn install' },
  { name: 'bun.lockb', packageManager: 'bun', lockfile: { '/project/bun.lockb': '' }, installCommand: 'bun install' },
  { name: 'bun.lock', packageManager: 'bun', lockfile: { '/project/bun.lock': '' }, installCommand: 'bun install' },
];

export const expectNodePackageManagerVariants = (
  frameworkName: string,
  dependencies: Record<string, string>,
  buildCommand?: string
) => {
  it.each(nodePackageManagerCases)(
    `should use $name for ${frameworkName} installs`,
    async ({ packageManager, lockfile, installCommand }) => {
      const result = await detectProject({
        '/project/package.json': packageJson(dependencies),
        ...lockfile,
      });

      expect(result.packageManager).toBe(packageManager);
      expect(result.config.commands).toEqual(buildCommand ? [installCommand, buildCommand] : [installCommand]);
    }
  );
};

export const expectNodePackageManagerPriority = (dependencies: Record<string, string>) => {
  it('should prefer Bun over pnpm, yarn, and npm lockfiles', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/bun.lockb': '',
      '/project/pnpm-lock.yaml': '',
      '/project/yarn.lock': '',
      '/project/package-lock.json': '',
    });

    expect(result.packageManager).toBe('bun');
    expect(result.config.commands[0]).toBe('bun install');
  });

  it('should prefer pnpm over yarn and npm lockfiles', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/pnpm-lock.yaml': '',
      '/project/yarn.lock': '',
      '/project/package-lock.json': '',
    });

    expect(result.packageManager).toBe('pnpm');
    expect(result.config.commands[0]).toBe('pnpm install');
  });
};

export const detectProject = (files: Record<string, string>) =>
  Effect.runPromise(detectFramework('/project').pipe(Effect.provide(Layer.merge(makeTestFs(files), TestPathLayer))));

export const detectProjectError = (files: Record<string, string>) =>
  Effect.runPromise(
    detectFramework('/project').pipe(
      Effect.catchTag('FrameworkNotDetectedError', (error) => Effect.succeed({ error })),
      Effect.provide(Layer.merge(makeTestFs(files), TestPathLayer))
    )
  );

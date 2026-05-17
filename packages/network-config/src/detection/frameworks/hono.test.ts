import { describe, expect, it } from 'vitest';
import {
  detectProject,
  expectNodePackageManagerPriority,
  expectNodePackageManagerVariants,
  packageJson,
} from './test-utils';

const dependencies = { hono: '^4.0.0' };

describe('Hono framework detection', () => {
  expectNodePackageManagerVariants('Hono', dependencies);
  expectNodePackageManagerPriority(dependencies);

  it('should detect Hono and generate src/index.ts server config', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/pnpm-lock.yaml': '',
    });

    expect(result.framework).toMatchObject({ slug: 'hono', name: 'Hono' });
    expect(result.packageManager).toBe('pnpm');
    expect(result.config.commands).toEqual(['pnpm install']);
    expect(result.config.entrypoints).toEqual([
      expect.objectContaining({
        path: 'src/index.ts',
        runtime: 'node-22',
        memory: 128,
        maxDuration: 30,
        streaming: true,
      }),
    ]);
    expect(result.config.routes).toEqual([expect.objectContaining({ path: '/*', destination: 'src/index.ts' })]);
  });

  it('should prefer Hono over Fastify and Express', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson({ ...dependencies, fastify: '^5.0.0', express: '^4.0.0' }),
    });

    expect(result.framework.slug).toBe('hono');
  });
});

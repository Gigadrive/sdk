import { describe, expect, it } from 'vitest';
import {
  detectProject,
  expectNodePackageManagerPriority,
  expectNodePackageManagerVariants,
  packageJson,
} from './test-utils';

const dependencies = { elysia: '^1.0.0' };

describe('Elysia framework detection', () => {
  expectNodePackageManagerVariants('Elysia', dependencies);
  expectNodePackageManagerPriority(dependencies);

  it('should detect Elysia and generate Bun server config', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/bun.lockb': '',
    });

    expect(result.framework).toMatchObject({ slug: 'elysia', name: 'Elysia' });
    expect(result.packageManager).toBe('bun');
    expect(result.config.commands).toEqual(['bun install']);
    expect(result.config.entrypoints).toEqual([
      expect.objectContaining({
        path: 'src/index.ts',
        runtime: 'bun-1',
        memory: 128,
        maxDuration: 30,
        streaming: true,
      }),
    ]);
    expect(result.config.routes).toEqual([expect.objectContaining({ path: '/*', destination: 'src/index.ts' })]);
  });

  it('should prefer Elysia over Fastify and Express', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson({ ...dependencies, fastify: '^5.0.0', express: '^4.0.0' }),
    });

    expect(result.framework.slug).toBe('elysia');
  });
});

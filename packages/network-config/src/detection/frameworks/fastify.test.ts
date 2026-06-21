import { describe, expect, it } from 'vitest';
import {
  detectProject,
  expectNodePackageManagerPriority,
  expectNodePackageManagerVariants,
  packageJson,
} from './test-utils';

const dependencies = { fastify: '^5.0.0' };

describe('Fastify framework detection', () => {
  expectNodePackageManagerVariants('Fastify', dependencies);
  expectNodePackageManagerPriority(dependencies);

  it('should detect Fastify and generate src/index.ts server config', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
    });

    expect(result.framework).toMatchObject({ slug: 'fastify', name: 'Fastify' });
    expect(result.config.commands).toEqual(['npm install']);
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

  it('should prefer Fastify over Express', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson({ ...dependencies, express: '^4.0.0' }),
    });

    expect(result.framework.slug).toBe('fastify');
  });
});

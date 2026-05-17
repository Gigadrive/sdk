import { describe, expect, it } from 'vitest';
import {
  detectProject,
  expectNodePackageManagerPriority,
  expectNodePackageManagerVariants,
  packageJson,
} from './test-utils';

const dependencies = { astro: '^5.0.0' };

describe('Astro framework detection', () => {
  expectNodePackageManagerVariants('Astro', dependencies, 'astro build');
  expectNodePackageManagerPriority(dependencies);

  it('should detect Astro and generate server/client build config', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/bun.lockb': '',
    });

    expect(result.framework).toMatchObject({ slug: 'astro', name: 'Astro' });
    expect(result.packageManager).toBe('bun');
    expect(result.config.commands).toEqual(['bun install', 'astro build']);
    expect(result.config.entrypoints).toEqual([
      expect.objectContaining({
        path: 'dist/server/entry.mjs',
        runtime: 'node-22',
        memory: 256,
        maxDuration: 30,
        streaming: true,
      }),
    ]);
    expect(result.config.routes).toEqual([
      expect.objectContaining({ path: '/*', destination: 'dist/server/entry.mjs' }),
    ]);
    expect(result.config.assets).toMatchObject({ prefixToStrip: 'dist/client/', populateCache: true });
  });

  it('should prefer Astro over Vite', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson({ ...dependencies, vite: '^7.0.0' }),
    });

    expect(result.framework.slug).toBe('astro');
  });
});

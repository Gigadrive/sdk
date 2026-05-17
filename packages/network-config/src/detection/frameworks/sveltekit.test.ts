import { describe, expect, it } from 'vitest';
import {
  detectProject,
  expectNodePackageManagerPriority,
  expectNodePackageManagerVariants,
  packageJson,
} from './test-utils';

const dependencies = { '@sveltejs/kit': '^2.0.0', vite: '^7.0.0' };

describe('SvelteKit framework detection', () => {
  expectNodePackageManagerVariants('SvelteKit', dependencies, 'vite build');
  expectNodePackageManagerPriority(dependencies);

  it('should detect SvelteKit and generate node adapter-style config', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/yarn.lock': '',
    });

    expect(result.framework).toMatchObject({ slug: 'sveltekit', name: 'SvelteKit' });
    expect(result.packageManager).toBe('yarn');
    expect(result.config.commands).toEqual(['yarn install', 'vite build']);
    expect(result.config.entrypoints).toEqual([
      expect.objectContaining({
        path: 'build/index.js',
        runtime: 'node-22',
        memory: 256,
        maxDuration: 30,
        streaming: true,
      }),
    ]);
    expect(result.config.routes).toEqual([expect.objectContaining({ path: '/*', destination: 'build/index.js' })]);
    expect(result.config.assets).toMatchObject({ prefixToStrip: 'build/client/', populateCache: true });
  });

  it('should prefer SvelteKit over Vite', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
    });

    expect(result.framework.slug).toBe('sveltekit');
  });
});

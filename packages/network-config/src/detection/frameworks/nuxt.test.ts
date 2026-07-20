import { describe, expect, it } from 'vitest';
import {
  detectProject,
  expectNodePackageManagerPriority,
  expectNodePackageManagerVariants,
  packageJson,
} from './test-utils';

const dependencies = { nuxt: '^4.0.0', vue: '^3.0.0' };

describe('Nuxt framework detection', () => {
  expectNodePackageManagerVariants('Nuxt', dependencies, 'nuxt build');
  expectNodePackageManagerPriority(dependencies);

  it('should detect Nuxt and generate Nitro node-server config', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/pnpm-lock.yaml': '',
    });

    expect(result.framework).toMatchObject({ slug: 'nuxt', name: 'Nuxt' });
    expect(result.packageManager).toBe('pnpm');
    expect(result.config.commands).toEqual(['pnpm install', 'nuxt build']);
    expect(result.config.entrypoints).toEqual([
      expect.objectContaining({
        path: '.output/server/index.mjs',
        runtime: 'node-22',
        memory: 256,
        maxDuration: 30,
        streaming: true,
      }),
    ]);
    expect(result.config.routes).toEqual([
      expect.objectContaining({ path: '/*', destination: '.output/server/index.mjs' }),
    ]);
    expect(result.config.assets).toMatchObject({ prefixToStrip: '.output/public/', populateCache: true });
    expect(result.config.environmentVariables).toEqual({ NODE_ENV: 'production', NITRO_PRESET: 'node-server' });
  });

  it('should defer functions and routes to Vercel Build Output v3', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/pnpm-lock.yaml': '',
      '/project/.vercel/output/config.json': JSON.stringify({ version: 3 }),
    });

    expect(result.framework).toMatchObject({ slug: 'nuxt', name: 'Nuxt' });
    expect(result.config.entrypoints).toEqual([]);
    expect(result.config.routes).toEqual([]);
    expect(result.config.assets).toMatchObject({
      prefixToStrip: '.vercel/output/static/',
      populateCache: true,
    });
    expect(result.config.environmentVariables).toEqual({ NODE_ENV: 'production', NITRO_PRESET: 'vercel' });
  });
});

import { describe, expect, it } from 'vitest';
import {
  detectProject,
  expectNodePackageManagerPriority,
  expectNodePackageManagerVariants,
  packageJson,
} from './test-utils';

const dependencies = { next: '^16.0.0', react: '^19.0.0' };

describe('Next.js framework detection', () => {
  expectNodePackageManagerVariants('Next.js', dependencies, 'next build');
  expectNodePackageManagerPriority(dependencies);

  it('should detect Next.js and generate standalone server config', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
    });

    expect(result.framework).toMatchObject({ slug: 'nextjs', name: 'Next.js' });
    expect(result.config.commands).toEqual(['npm install', 'next build']);
    expect(result.config.entrypoints).toEqual([
      expect.objectContaining({
        path: '.next/standalone/server.js',
        runtime: 'node-22',
        memory: 256,
        maxDuration: 30,
        streaming: true,
      }),
    ]);
    expect(result.config.routes).toEqual([
      expect.objectContaining({ path: '/*', destination: '.next/standalone/server.js' }),
    ]);
    expect(result.config.assets).toMatchObject({
      prefixToStrip: '.next/static/',
      dynamicRoutes: true,
      populateCache: true,
    });
    expect(result.config.environmentVariables).toEqual({ NODE_ENV: 'production' });
  });

  it('should prefer Next.js over lower-priority Vite', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson({ ...dependencies, vite: '^7.0.0' }),
    });

    expect(result.framework.slug).toBe('nextjs');
  });
});

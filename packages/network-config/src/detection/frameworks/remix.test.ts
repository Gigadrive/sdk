import { describe, expect, it } from 'vitest';
import {
  detectProject,
  expectNodePackageManagerPriority,
  expectNodePackageManagerVariants,
  packageJson,
} from './test-utils';

const dependencies = { '@remix-run/dev': '^2.0.0', express: '^4.0.0' };

describe('Remix framework detection', () => {
  expectNodePackageManagerVariants('Remix', dependencies, 'remix build');
  expectNodePackageManagerPriority(dependencies);

  it('should detect Remix and generate server/client build config', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
    });

    expect(result.framework).toMatchObject({ slug: 'remix', name: 'Remix' });
    expect(result.config.commands).toEqual(['npm install', 'remix build']);
    expect(result.config.entrypoints).toEqual([
      expect.objectContaining({
        path: 'build/server/index.js',
        runtime: 'node-22',
        memory: 256,
        maxDuration: 30,
        streaming: true,
      }),
    ]);
    expect(result.config.routes).toEqual([
      expect.objectContaining({ path: '/*', destination: 'build/server/index.js' }),
    ]);
    expect(result.config.assets).toMatchObject({ prefixToStrip: 'build/client/', populateCache: true });
  });

  it('should prefer Remix over Express', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
    });

    expect(result.framework.slug).toBe('remix');
  });
});

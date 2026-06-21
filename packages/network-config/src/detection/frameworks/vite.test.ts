import { describe, expect, it } from 'vitest';
import {
  detectProject,
  expectNodePackageManagerPriority,
  expectNodePackageManagerVariants,
  packageJson,
} from './test-utils';

const dependencies = { vite: '^7.0.0', react: '^19.0.0' };

describe('Vite framework detection', () => {
  expectNodePackageManagerVariants('Vite', dependencies, 'vite build');
  expectNodePackageManagerPriority(dependencies);

  it('should detect Vite and generate static asset config without server entrypoints', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
    });

    expect(result.framework).toMatchObject({ slug: 'vite', name: 'Vite' });
    expect(result.config.commands).toEqual(['npm install', 'vite build']);
    expect(result.config.entrypoints).toEqual([]);
    expect(result.config.routes).toEqual([]);
    expect(result.config.assets).toMatchObject({ prefixToStrip: 'dist/', populateCache: true });
    expect(result.config.environmentVariables).toEqual({ NODE_ENV: 'production' });
  });
});

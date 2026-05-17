import { describe, expect, it } from 'vitest';
import {
  detectProject,
  expectNodePackageManagerPriority,
  expectNodePackageManagerVariants,
  packageJson,
} from './test-utils';

const dependencies = { express: '^4.0.0' };

describe('Express framework detection', () => {
  expectNodePackageManagerVariants('Express', dependencies);
  expectNodePackageManagerPriority(dependencies);

  it('should detect Express and generate index.js server config', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
    });

    expect(result.framework).toMatchObject({ slug: 'express', name: 'Express' });
    expect(result.config.commands).toEqual(['npm install']);
    expect(result.config.entrypoints).toEqual([
      expect.objectContaining({
        path: 'index.js',
        runtime: 'node-22',
        memory: 128,
        maxDuration: 30,
        streaming: true,
      }),
    ]);
    expect(result.config.routes).toEqual([expect.objectContaining({ path: '/*', destination: 'index.js' })]);
    expect(result.config.assets).toBeUndefined();
  });
});

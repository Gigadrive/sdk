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

  it('should resolve the entrypoint from the package.json main field', async () => {
    const result = await detectProject({
      '/project/package.json': JSON.stringify({
        dependencies,
        main: 'src/index.js',
        scripts: { start: 'node src/index.js' },
      }),
      '/project/src/index.js': '',
    });

    expect(result.config.entrypoints[0].path).toBe('src/index.js');
    expect(result.config.routes[0].destination).toBe('src/index.js');
  });

  it('should resolve the entrypoint from the start script when main is absent', async () => {
    const result = await detectProject({
      '/project/package.json': JSON.stringify({
        dependencies,
        scripts: { start: 'node src/server.js' },
      }),
      '/project/src/server.js': '',
    });

    expect(result.config.entrypoints[0].path).toBe('src/server.js');
    expect(result.config.routes[0].destination).toBe('src/server.js');
  });

  it('should skip start script flags when extracting the entrypoint', async () => {
    const result = await detectProject({
      '/project/package.json': JSON.stringify({
        dependencies,
        scripts: { start: 'node --env-file=.env src/server.js' },
      }),
      '/project/src/server.js': '',
    });

    expect(result.config.entrypoints[0].path).toBe('src/server.js');
  });

  it('should ignore a main field pointing to a missing file and probe common candidates', async () => {
    const result = await detectProject({
      '/project/package.json': JSON.stringify({ dependencies, main: 'dist/index.js' }),
      '/project/app.js': '',
    });

    expect(result.config.entrypoints[0].path).toBe('app.js');
    expect(result.config.routes[0].destination).toBe('app.js');
  });

  it('should ignore a main field pointing to a directory', async () => {
    const result = await detectProject({
      '/project/package.json': JSON.stringify({ dependencies, main: 'src' }),
      '/project/src/index.js': '',
    });

    expect(result.config.entrypoints[0].path).toBe('src/index.js');
  });

  it.each(['/abs/index.js', '../outside/index.js', 'C:\\index.js'])(
    'should ignore unsafe main path %s',
    async (main) => {
      const result = await detectProject({
        '/project/package.json': JSON.stringify({ dependencies, main }),
      });

      expect(result.config.entrypoints[0].path).toBe('index.js');
    }
  );

  it('should ignore start scripts that are not a plain runner invocation', async () => {
    const result = await detectProject({
      '/project/package.json': JSON.stringify({
        dependencies,
        scripts: { start: 'npm run build && node dist/index.js' },
      }),
    });

    expect(result.config.entrypoints[0].path).toBe('index.js');
  });

  it('should prefer the default entrypoint over other candidates when it exists', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/index.js': '',
      '/project/server.js': '',
    });

    expect(result.config.entrypoints[0].path).toBe('index.js');
  });

  it('should fall back to the default entrypoint when nothing can be resolved', async () => {
    const result = await detectProject({
      '/project/package.json': JSON.stringify({ dependencies, scripts: { start: 'nodemon' } }),
    });

    expect(result.config.entrypoints[0].path).toBe('index.js');
    expect(result.config.routes[0].destination).toBe('index.js');
  });
});

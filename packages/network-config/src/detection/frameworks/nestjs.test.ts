import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import { makeTestFs, TestPathLayer } from '../../test-utils';
import { detectFramework } from '../detect-framework';
import {
  detectProject,
  expectNodePackageManagerPriority,
  expectNodePackageManagerVariants,
  packageJson,
} from './test-utils';

const dependencies = { '@nestjs/core': '^10.0.0' };

describe('NestJS framework detection', () => {
  expectNodePackageManagerVariants('NestJS', dependencies, 'nest build');
  expectNodePackageManagerPriority(dependencies);

  it('should detect NestJS from package.json', async () => {
    const fs = makeTestFs({
      '/project/package.json': JSON.stringify({
        dependencies: { ...dependencies, express: '^4.0.0' },
      }),
    });

    const result = await Effect.runPromise(
      detectFramework('/project').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    // NestJS has higher priority than Express.
    expect(result.framework.slug).toBe('nestjs');
    expect(result.config.entrypoints[0].path).toBe('dist/main.js');
    expect(result.config.entrypoints[0].package).toBeUndefined();
  });

  it('should derive NestJS output path from nest-cli.json', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/nest-cli.json': JSON.stringify({
        compilerOptions: { outputPath: 'build' },
      }),
    });

    expect(result.framework.slug).toBe('nestjs');
    expect(result.config.entrypoints[0].path).toBe('build/main.js');
    expect(result.config.routes[0].destination).toBe('build/main.js');
    expect(result.config.entrypoints[0].package).toBeUndefined();
  });

  it('should normalize dot-prefixed and trailing-slash NestJS output paths', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/nest-cli.json': JSON.stringify({
        compilerOptions: { outputPath: './build/' },
      }),
    });

    expect(result.config.entrypoints[0].path).toBe('build/main.js');
    expect(result.config.routes[0].destination).toBe('build/main.js');
  });

  it('should derive NestJS output path from the default project in nest-cli.json', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/nest-cli.json': JSON.stringify({
        defaultProject: 'api',
        projects: {
          worker: { compilerOptions: { outputPath: 'dist/worker' } },
          api: { compilerOptions: { outputPath: 'dist/api' } },
        },
      }),
    });

    expect(result.config.entrypoints[0].path).toBe('dist/api/main.js');
    expect(result.config.routes[0].destination).toBe('dist/api/main.js');
  });

  it('should fall back to the first NestJS project output path when no default project is configured', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/nest-cli.json': JSON.stringify({
        projects: {
          api: { compilerOptions: { outputPath: 'dist/api' } },
          worker: { compilerOptions: { outputPath: 'dist/worker' } },
        },
      }),
    });

    expect(result.config.entrypoints[0].path).toBe('dist/api/main.js');
    expect(result.config.routes[0].destination).toBe('dist/api/main.js');
  });

  it('should ignore malformed NestJS CLI config and keep the default output path', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/nest-cli.json': '{not-json',
    });

    expect(result.config.entrypoints[0].path).toBe('dist/main.js');
    expect(result.config.routes[0].destination).toBe('dist/main.js');
  });

  it('should ignore non-string NestJS output paths and keep the default output path', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/nest-cli.json': JSON.stringify({
        compilerOptions: { outputPath: 42 },
      }),
    });

    expect(result.config.entrypoints[0].path).toBe('dist/main.js');
    expect(result.config.routes[0].destination).toBe('dist/main.js');
  });

  it.each(['/tmp/build', '../build', 'nested/../build', ''])(
    'should ignore unsafe NestJS output path %s and keep the default output path',
    async (outputPath) => {
      const result = await detectProject({
        '/project/package.json': packageJson(dependencies),
        '/project/nest-cli.json': JSON.stringify({
          compilerOptions: { outputPath },
        }),
      });

      expect(result.config.entrypoints[0].path).toBe('dist/main.js');
      expect(result.config.routes[0].destination).toBe('dist/main.js');
    }
  );
});

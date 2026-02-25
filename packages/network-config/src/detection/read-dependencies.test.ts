import { FileSystem } from '@effect/platform';
import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import { makeTestFs, TestPathLayer } from '../test-utils';
import { readDependencies } from './read-dependencies';

describe('readDependencies', () => {
  it('should read node dependencies from package.json', async () => {
    const fs = makeTestFs({
      '/project/package.json': JSON.stringify({
        dependencies: { next: '^14.0.0', react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      }),
    });

    const result = await Effect.runPromise(
      readDependencies('/project', 'node').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    expect(result).toEqual(new Set(['next', 'react', 'typescript']));
  });

  it('should read php dependencies from composer.json', async () => {
    const fs = makeTestFs({
      '/project/composer.json': JSON.stringify({
        require: { php: '^8.1', 'laravel/framework': '^11.0' },
        'require-dev': { 'phpunit/phpunit': '^10.0' },
      }),
    });

    const result = await Effect.runPromise(
      readDependencies('/project', 'php').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    expect(result).toEqual(new Set(['php', 'laravel/framework', 'phpunit/phpunit']));
  });

  it('should return empty set when manifest does not exist', async () => {
    const fs = makeTestFs({});

    const result = await Effect.runPromise(
      readDependencies('/project', 'node').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    expect(result).toEqual(new Set());
  });

  it('should return empty set when manifest has no dependency sections', async () => {
    const fs = makeTestFs({
      '/project/package.json': JSON.stringify({ name: 'my-project', version: '1.0.0' }),
    });

    const result = await Effect.runPromise(
      readDependencies('/project', 'node').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    expect(result).toEqual(new Set());
  });

  it('should fail with ManifestParseError when manifest is invalid JSON', async () => {
    const fs = makeTestFs({
      '/project/package.json': 'not valid json{{{',
    });

    const result = await Effect.runPromiseExit(
      readDependencies('/project', 'node').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );
    expect(result._tag).toBe('Failure');
  });

  it('should merge dependencies and devDependencies for node', async () => {
    const fs = makeTestFs({
      '/project/package.json': JSON.stringify({
        dependencies: { express: '^4.0.0' },
        devDependencies: { express: '^4.0.0', vitest: '^1.0.0' },
      }),
    });

    const result = await Effect.runPromise(
      readDependencies('/project', 'node').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    expect(result).toEqual(new Set(['express', 'vitest']));
  });

  it('should propagate ManifestReadError when file exists but cannot be read', async () => {
    const errorFs = Layer.merge(
      Layer.succeed(FileSystem.FileSystem, {
        exists: (p: string) => Effect.succeed(p === '/project/package.json'),
        readFileString: () => Effect.fail(new Error('Permission denied')),
      } as unknown as FileSystem.FileSystem),
      TestPathLayer
    );

    const result = await Effect.runPromiseExit(readDependencies('/project', 'node').pipe(Effect.provide(errorFs)));

    expect(result._tag).toBe('Failure');
    if (result._tag === 'Failure') {
      const cause = result.cause;
      expect(JSON.stringify(cause)).toContain('ManifestReadError');
    }
  });

  it('should propagate ManifestParseError with correct _tag', async () => {
    const fs = makeTestFs({
      '/project/package.json': 'not valid json{{{',
    });

    const result = await Effect.runPromise(
      readDependencies('/project', 'node').pipe(
        Effect.catchTag('ManifestParseError', (e) => Effect.succeed({ _tag: e._tag, filePath: e.filePath })),
        Effect.provide(Layer.merge(fs, TestPathLayer))
      )
    );

    expect(result).toMatchObject({ _tag: 'ManifestParseError', filePath: '/project/package.json' });
  });
});

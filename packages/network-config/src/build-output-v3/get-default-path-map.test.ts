import { FileSystem } from '@effect/platform';
import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import { makeTestFs, TestPathLayer } from '../test-utils';
import { getDefaultPathMap } from './get-default-path-map';

const run = (files: Record<string, string>, directory: string) =>
  Effect.runPromise(getDefaultPathMap(directory).pipe(Effect.provide(Layer.merge(makeTestFs(files), TestPathLayer))));

describe('getDefaultPathMap', () => {
  it('should return empty object if directory does not exist', async () => {
    const result = await run({}, '/non-existent-dir');
    expect(result).toEqual({});
  });

  it('should map files correctly in a directory', async () => {
    const result = await run(
      {
        '/test-dir/file1.txt': 'content',
        '/test-dir/file2.js': 'content',
      },
      '/test-dir'
    );

    expect(result).toEqual({
      '/test-dir/file1.txt': 'file1.txt',
      '/test-dir/file2.js': 'file2.js',
    });
  });

  it('should recursively process nested directories', async () => {
    const result = await run(
      {
        '/test-dir/file1.txt': 'content',
        '/test-dir/subdir/file2.js': 'content',
      },
      '/test-dir'
    );

    expect(result).toEqual({
      '/test-dir/file1.txt': 'file1.txt',
      '/test-dir/subdir/file2.js': 'subdir/file2.js',
    });
  });

  it('should respect MAX_DEPTH limit for deeply nested directories', async () => {
    let readDirCalls = 0;

    const loopFs = Layer.succeed(FileSystem.FileSystem, {
      exists: (p: string) => Effect.succeed(p === '/deep' || p.startsWith('/deep/')),
      readFileString: () => Effect.fail(new Error('Not implemented')),
      readDirectory: () => {
        readDirCalls++;
        return Effect.succeed(['file.txt', 'sub']);
      },
      stat: (p: string) => {
        if (p.endsWith('/file.txt')) {
          return Effect.succeed({ type: 'File' } as unknown as FileSystem.File.Info);
        }
        return Effect.succeed({ type: 'Directory' } as unknown as FileSystem.File.Info);
      },
    } as unknown as FileSystem.FileSystem);

    const result = await Effect.runPromise(
      getDefaultPathMap('/deep').pipe(Effect.provide(Layer.merge(loopFs, TestPathLayer)))
    );

    // Should terminate due to depth limit (101 calls for depth 0..100)
    expect(readDirCalls).toBe(101);
    expect(Object.keys(result).length).toBeGreaterThan(0);
    expect(Object.keys(result).length).toBeLessThanOrEqual(101);
  });
});

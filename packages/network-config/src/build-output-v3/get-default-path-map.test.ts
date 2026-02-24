import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { makeTestFs } from '../test-utils';
import { getDefaultPathMap } from './get-default-path-map';

const run = (files: Record<string, string>, directory: string) =>
  Effect.runPromise(getDefaultPathMap(directory).pipe(Effect.provide(makeTestFs(files))));

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
});

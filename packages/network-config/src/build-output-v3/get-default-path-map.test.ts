import mockFs from 'mock-fs';
import { afterEach, describe, expect, test } from 'vitest';
import { getDefaultPathMap } from './get-default-path-map';

describe('getDefaultPathMap', () => {
  afterEach(() => {
    mockFs.restore();
  });

  test('should return empty object if directory does not exist', () => {
    mockFs({});

    const result = getDefaultPathMap('/non-existent-dir');

    expect(result).toEqual({});
  });

  test('should map files correctly in a directory', () => {
    mockFs({
      '/test-dir': {
        'file1.txt': 'content',
        'file2.js': 'content',
      },
    });

    const result = getDefaultPathMap('/test-dir');

    expect(result).toEqual({
      '/test-dir/file1.txt': 'file1.txt',
      '/test-dir/file2.js': 'file2.js',
    });
  });

  test('should recursively process nested directories', () => {
    mockFs({
      '/test-dir': {
        'file1.txt': 'content',
        subdir: {
          'file2.js': 'content',
        },
      },
    });

    const result = getDefaultPathMap('/test-dir');

    expect(result).toEqual({
      '/test-dir/file1.txt': 'file1.txt',
      '/test-dir/subdir/file2.js': 'subdir/file2.js',
    });
  });
});

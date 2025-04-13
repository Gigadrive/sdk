import { describe, expect, test } from 'vitest';
import { FilePathMap } from '../normalized-config';
import { getMonorepoFiles } from './get-monorepo-files';

describe('getMonorepoFiles', () => {
  test('should return files outside the project directory', () => {
    const directory = '/project';
    const filePathMaps: FilePathMap[] = [
      {
        '/project/src/index.ts': 'index.js',
        '/workspace/node_modules/utils.js': 'utils.js',
      },
    ];

    const result = getMonorepoFiles(directory, filePathMaps);
    expect(result).toEqual(['/workspace/node_modules/utils.js']);
  });

  test('should return empty array when all files are within the project directory', () => {
    const directory = '/project';
    const filePathMaps: FilePathMap[] = [
      {
        '/project/src/index.ts': 'index.js',
        '/project/src/utils/helper.js': 'utils/helper.js',
      },
    ];

    const result = getMonorepoFiles(directory, filePathMaps);
    expect(result).toEqual([]);
  });

  test('should handle empty file path maps', () => {
    const directory = '/project';
    const filePathMaps: FilePathMap[] = [];

    const result = getMonorepoFiles(directory, filePathMaps);
    expect(result).toEqual([]);
  });
});

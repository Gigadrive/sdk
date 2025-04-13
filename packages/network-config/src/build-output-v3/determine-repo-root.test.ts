import { describe, expect, test } from 'vitest';
import type { NormalizedConfig } from '../normalized-config';
import { determineRepoRoot } from './determine-repo-root';

describe('determineRepoRoot', () => {
  test('should return project folder when no entrypoints are provided', () => {
    const projectFolder = '/project';
    const config: Partial<NormalizedConfig> = {};

    expect(determineRepoRoot(projectFolder, config)).toBe(projectFolder);
  });

  test('should return project folder when entrypoints have no file path maps', () => {
    const projectFolder = '/project';
    const config: Partial<NormalizedConfig> = {
      entrypoints: [
        {
          runtime: 'node-18',
          memory: 1024,
          maxDuration: 15,
          path: '/api',
        },
      ],
    };

    expect(determineRepoRoot(projectFolder, config)).toBe(projectFolder);
  });

  test('should determine common root directory from file paths', () => {
    const projectFolder = '/project';
    const config: Partial<NormalizedConfig> = {
      entrypoints: [
        {
          runtime: 'node-18',
          memory: 1024,
          maxDuration: 15,
          path: '/api',
          package: {
            filePathMap: {
              '/project/packages/api/src/index.ts': 'index.js',
              '/project/packages/api/src/utils.ts': 'utils.js',
            },
          },
        },
      ],
    };

    expect(determineRepoRoot(projectFolder, config)).toBe('/project');
  });

  test('should handle Next.js monorepo example', () => {
    const projectFolder = '/project/apps/next';
    const config: Partial<NormalizedConfig> = {
      entrypoints: [
        {
          runtime: 'node-18',
          memory: 1024,
          maxDuration: 15,
          path: '/api',
          package: {
            filePathMap: {
              '/project/apps/next/src/index.ts': 'index.js',
            },
          },
        },
        {
          runtime: 'node-18',
          memory: 1024,
          maxDuration: 15,
          path: '/ui',
          package: {
            filePathMap: {
              '/project/node_modules/example': 'index.js',
            },
          },
        },
      ],
    };

    expect(determineRepoRoot(projectFolder, config)).toBe('/project');
  });
});

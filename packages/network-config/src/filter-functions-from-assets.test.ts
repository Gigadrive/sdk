import { describe, expect, it } from 'vitest';
import { filterFunctionsFromAssets } from './filter-functions-from-assets';
import type { NormalizedConfig } from './normalized-config';

describe('filterFunctionsFromAssets', () => {
  it('should filter out assets that are also functions', async () => {
    // Create a mock config with overlapping assets and functions
    const mockConfig: NormalizedConfig = {
      regions: ['us-east-1'],
      environmentVariables: {},
      commands: [],
      entrypoints: [
        {
          path: 'public/api/index.js',
          runtime: 'node-20',
          memory: 128,
          maxDuration: 30,
        },
        {
          path: 'public/special.js',
          runtime: 'node-20',
          memory: 128,
          maxDuration: 30,
        },
      ],
      assets: {
        paths: [
          'public/index.html',
          'public/styles.css',
          'public/api/index.js', // This should be filtered out
          'public/special.js', // This should be filtered out
          'public/images/logo.png',
        ],
        prefixToStrip: 'public/',
        dynamicRoutes: true,
        populateCache: false,
      },
      routes: [],
      warnings: [],
      errors: [],
    };

    const result = await filterFunctionsFromAssets(mockConfig);

    // Check that the function paths were removed from assets
    expect(result.assets?.paths).toEqual(['public/index.html', 'public/styles.css', 'public/images/logo.png']);

    // Check that the original config was not modified
    expect(mockConfig.assets?.paths).toContain('public/api/index.js');
    expect(mockConfig.assets?.paths).toContain('public/special.js');
  });

  it('should handle undefined assets paths', async () => {
    const mockConfig: NormalizedConfig = {
      regions: ['us-east-1'],
      environmentVariables: {},
      commands: [],
      entrypoints: [
        {
          path: 'src/api/index.js',
          runtime: 'node-20',
          memory: 128,
          maxDuration: 30,
        },
      ],
      assets: {
        prefixToStrip: 'public/',
        dynamicRoutes: true,
        populateCache: false,
      },
      routes: [],
      warnings: [],
      errors: [],
    };

    const result = await filterFunctionsFromAssets(mockConfig);

    // Should not throw and should maintain the structure
    expect(result.assets).toEqual(mockConfig.assets);
  });

  it('should handle undefined assets object', async () => {
    const mockConfig: NormalizedConfig = {
      regions: ['us-east-1'],
      environmentVariables: {},
      commands: [],
      entrypoints: [
        {
          path: 'src/api/index.js',
          runtime: 'node-20',
          memory: 128,
          maxDuration: 30,
        },
      ],
      routes: [],
      warnings: [],
      errors: [],
    };

    const result = await filterFunctionsFromAssets(mockConfig);

    // Should not throw and should maintain the structure
    expect(result.assets?.paths).toBeUndefined();
  });

  it('should handle empty assets paths array', async () => {
    const mockConfig: NormalizedConfig = {
      regions: ['us-east-1'],
      environmentVariables: {},
      commands: [],
      entrypoints: [
        {
          path: 'src/api/index.js',
          runtime: 'node-20',
          memory: 128,
          maxDuration: 30,
        },
      ],
      assets: {
        paths: [],
        prefixToStrip: 'public/',
        dynamicRoutes: true,
        populateCache: false,
      },
      routes: [],
      warnings: [],
      errors: [],
    };

    const result = await filterFunctionsFromAssets(mockConfig);

    // Should return empty array
    expect(result.assets?.paths).toEqual([]);
  });
});

import { FileSystem } from '@effect/platform';
import { NodeContext } from '@effect/platform-node';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { Effect, Layer } from 'effect';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import type { NormalizedConfig, NormalizedConfigEntrypoint, NormalizedConfigRoute } from '../normalized-config';
import { AVAILABLE_REGIONS } from '../regions';
import { makeTestFs, TestPathLayer } from '../test-utils';
import type { ConfigV4 } from '../v4';
import { getFunctionSettings, V4ConfigParser } from './v4-config-parser';

/** Load the example.yaml fixture as a raw object. */
const loadExample = (): Record<string, unknown> => {
  const content = fs.readFileSync(path.join(__dirname, '../v4/example.yaml'), 'utf8');
  return parseYaml(content) as Record<string, unknown>;
};

const withTempFunctionProject = async <T>(run: (projectFolder: string) => Promise<T>): Promise<T> => {
  const projectFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'network-config-v4-'));
  try {
    fs.mkdirSync(path.join(projectFolder, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(projectFolder, 'dist/main.js'), 'exports.handler = () => {}');
    fs.writeFileSync(path.join(projectFolder, 'dist/health.js'), 'exports.handler = () => {}');
    return await run(projectFolder);
  } finally {
    fs.rmSync(projectFolder, { recursive: true, force: true });
  }
};

const requireAssets = (result: NormalizedConfig): NonNullable<NormalizedConfig['assets']> => {
  if (result.assets == null) throw new Error('Expected assets to be defined');
  return result.assets;
};

const requireAssetPaths = (result: NormalizedConfig): string[] => {
  const paths = requireAssets(result).paths;
  if (paths == null) throw new Error('Expected asset paths to be defined');
  return paths;
};

const requireEntrypoint = (result: NormalizedConfig, index = 0): NormalizedConfigEntrypoint => {
  const entrypoint = result.entrypoints[index];
  if (entrypoint == null) throw new Error(`Expected entrypoint at index ${index}`);
  return entrypoint;
};

const requireRoute = (result: NormalizedConfig, index = 0): NormalizedConfigRoute => {
  const route = result.routes[index];
  if (route == null) throw new Error(`Expected route at index ${index}`);
  return route;
};

describe('V4ConfigParser', () => {
  it('check if example matches schema', () => {
    const config = loadExample();

    const schemaFile = fs.readFileSync(path.join(__dirname, '../v4/schema.json'), 'utf8');
    const schema = JSON.parse(schemaFile);

    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    const valid = validate(config);

    expect(valid).toBe(true);
    expect(config).toMatchObject({
      version: 4,
      regions: ['global'],
      build_commands: ['bun install'],
    });
  });

  it('should parse a V4 config into NormalizedConfig', async () => {
    const config = loadExample() as unknown as ConfigV4;
    const projectFolder = path.join(__dirname, '../v4');

    const result = await Effect.runPromise(
      V4ConfigParser.parse(config, projectFolder).pipe(
        Effect.provide(V4ConfigParser.Default),
        Effect.provide(NodeContext.layer)
      )
    );

    expect(result.regions).toEqual(AVAILABLE_REGIONS);
    expect(result.commands).toEqual(['bun install']);
  });

  it('getFunctionSettings', () => {
    const config = loadExample();

    expect(getFunctionSettings('src/index.ts', config as unknown as ConfigV4)).toEqual({
      runtime: 'bun-1',
      memory: 128,
      max_duration: 15,
      schedule: undefined,
      excludeFiles: undefined,
      includeFiles: undefined,
      symlinks: {
        'var/log': '/tmp/logs',
      },
    });

    expect(getFunctionSettings('src/cron.ts', config as unknown as ConfigV4)).toEqual({
      runtime: 'bun-1',
      memory: 128,
      max_duration: 15,
      schedule: 'rate(5 minutes)',
      excludeFiles: undefined,
      includeFiles: undefined,
      symlinks: {
        'var/log': '/tmp/logs',
      },
    });

    expect(getFunctionSettings('app/test.ts', config as unknown as ConfigV4)).toBeUndefined();
    expect(getFunctionSettings('test/index.ts', config as unknown as ConfigV4)).toBeUndefined();
  });

  it('should preserve function includeFiles and excludeFiles as package rules', async () => {
    await withTempFunctionProject(async (projectFolder) => {
      const config: ConfigV4 = {
        version: 4,
        functions: {
          'dist/main.js': {
            runtime: 'node-22',
            includeFiles: ['maxmind/**'],
            excludeFiles: ['**/*.map'],
          },
        },
      };

      const result = await Effect.runPromise(
        V4ConfigParser.parse(config, projectFolder).pipe(
          Effect.provide(V4ConfigParser.Default),
          Effect.provide(NodeContext.layer)
        )
      );

      expect(requireEntrypoint(result).package).toEqual({
        includeFiles: ['maxmind/**'],
        excludeFiles: ['**/*.map'],
      });
    });
  });

  it('should default Node functions to response streaming', async () => {
    await withTempFunctionProject(async (projectFolder) => {
      const config: ConfigV4 = {
        version: 4,
        functions: {
          'dist/main.js': {
            runtime: 'node-22',
          },
        },
        routes: [{ source: '/*', destination: 'dist/main.js' }],
      };

      const result = await Effect.runPromise(
        V4ConfigParser.parse(config, projectFolder).pipe(
          Effect.provide(V4ConfigParser.Default),
          Effect.provide(NodeContext.layer)
        )
      );

      expect(requireEntrypoint(result).streaming).toBe(true);
      expect(requireRoute(result).handler).toBe('SERVERLESS_FUNCTION_STREAMING');
    });
  });

  it('should allow explicitly disabling function streaming', async () => {
    await withTempFunctionProject(async (projectFolder) => {
      const config: ConfigV4 = {
        version: 4,
        functions: {
          'dist/main.js': {
            runtime: 'node-22',
            streaming: false,
          },
        },
        routes: [{ source: '/*', destination: 'dist/main.js' }],
      };

      const result = await Effect.runPromise(
        V4ConfigParser.parse(config, projectFolder).pipe(
          Effect.provide(V4ConfigParser.Default),
          Effect.provide(NodeContext.layer)
        )
      );

      expect(requireEntrypoint(result).streaming).toBe(false);
      expect(requireRoute(result).handler).toBe('SERVERLESS_FUNCTION');
    });
  });

  it('should preserve explicitly enabled function streaming and route handlers', async () => {
    await withTempFunctionProject(async (projectFolder) => {
      const config: ConfigV4 = {
        version: 4,
        functions: {
          'dist/main.js': {
            runtime: 'node-22',
            streaming: true,
          },
        },
        routes: [{ source: '/*', destination: 'dist/main.js' }],
      };

      const result = await Effect.runPromise(
        V4ConfigParser.parse(config, projectFolder).pipe(
          Effect.provide(V4ConfigParser.Default),
          Effect.provide(NodeContext.layer)
        )
      );

      expect(requireEntrypoint(result).streaming).toBe(true);
      expect(requireRoute(result).handler).toBe('SERVERLESS_FUNCTION_STREAMING');
    });
  });

  it('should match streaming function routes with absolute destinations', async () => {
    await withTempFunctionProject(async (projectFolder) => {
      const config: ConfigV4 = {
        version: 4,
        functions: {
          'dist/main.js': {
            runtime: 'node-22',
          },
        },
        routes: [{ source: '/*', destination: '/dist/main.js' }],
      };

      const result = await Effect.runPromise(
        V4ConfigParser.parse(config, projectFolder).pipe(
          Effect.provide(V4ConfigParser.Default),
          Effect.provide(NodeContext.layer)
        )
      );

      expect(requireRoute(result).handler).toBe('SERVERLESS_FUNCTION_STREAMING');
    });
  });

  it('should match streaming function routes with substituted destinations', async () => {
    await withTempFunctionProject(async (projectFolder) => {
      fs.mkdirSync(path.join(projectFolder, 'pages'), { recursive: true });
      fs.writeFileSync(path.join(projectFolder, 'pages/user.tsx'), 'exports.handler = () => {}');

      const config: ConfigV4 = {
        version: 4,
        functions: {
          'pages/*.tsx': {
            runtime: 'node-22',
          },
        },
        routes: [{ source: '/pages/(.*)', destination: '/pages/$1.tsx?name=$1' }],
      };

      const result = await Effect.runPromise(
        V4ConfigParser.parse(config, projectFolder).pipe(
          Effect.provide(V4ConfigParser.Default),
          Effect.provide(NodeContext.layer)
        )
      );

      expect(requireRoute(result).handler).toBe('SERVERLESS_FUNCTION_STREAMING');
    });
  });

  it('should normalize scalar includeFiles and excludeFiles into package rule arrays', async () => {
    await withTempFunctionProject(async (projectFolder) => {
      const config: ConfigV4 = {
        version: 4,
        functions: {
          'dist/main.js': {
            runtime: 'node-22',
            includeFiles: 'maxmind/**',
            excludeFiles: '**/*.map',
          },
        },
      };

      const result = await Effect.runPromise(
        V4ConfigParser.parse(config, projectFolder).pipe(
          Effect.provide(V4ConfigParser.Default),
          Effect.provide(NodeContext.layer)
        )
      );

      expect(requireEntrypoint(result).package).toEqual({
        includeFiles: ['maxmind/**'],
        excludeFiles: ['**/*.map'],
      });
    });
  });

  it('should preserve package rules when only includeFiles is configured', async () => {
    await withTempFunctionProject(async (projectFolder) => {
      const config: ConfigV4 = {
        version: 4,
        functions: {
          'dist/main.js': {
            runtime: 'node-22',
            includeFiles: ['maxmind/**'],
          },
        },
      };

      const result = await Effect.runPromise(
        V4ConfigParser.parse(config, projectFolder).pipe(
          Effect.provide(V4ConfigParser.Default),
          Effect.provide(NodeContext.layer)
        )
      );

      expect(requireEntrypoint(result).package).toEqual({
        includeFiles: ['maxmind/**'],
        excludeFiles: undefined,
      });
    });
  });

  it('should preserve package rules when only excludeFiles is configured', async () => {
    await withTempFunctionProject(async (projectFolder) => {
      const config: ConfigV4 = {
        version: 4,
        functions: {
          'dist/main.js': {
            runtime: 'node-22',
            excludeFiles: ['**/*.map'],
          },
        },
      };

      const result = await Effect.runPromise(
        V4ConfigParser.parse(config, projectFolder).pipe(
          Effect.provide(V4ConfigParser.Default),
          Effect.provide(NodeContext.layer)
        )
      );

      expect(requireEntrypoint(result).package).toEqual({
        includeFiles: undefined,
        excludeFiles: ['**/*.map'],
      });
    });
  });

  it('should not create package metadata when includeFiles and excludeFiles are absent', async () => {
    await withTempFunctionProject(async (projectFolder) => {
      const config: ConfigV4 = {
        version: 4,
        functions: {
          'dist/main.js': {
            runtime: 'node-22',
          },
        },
      };

      const result = await Effect.runPromise(
        V4ConfigParser.parse(config, projectFolder).pipe(
          Effect.provide(V4ConfigParser.Default),
          Effect.provide(NodeContext.layer)
        )
      );

      expect(requireEntrypoint(result).package).toBeUndefined();
    });
  });

  it('should merge package rules from broad function settings into matching concrete functions', async () => {
    await withTempFunctionProject(async (projectFolder) => {
      const config: ConfigV4 = {
        version: 4,
        functions: {
          'dist/*.js': {
            runtime: 'node-22',
            includeFiles: ['shared/**'],
            excludeFiles: ['**/*.map'],
          },
          'dist/main.js': {
            memory: 512,
            includeFiles: ['maxmind/**'],
          },
        },
      };

      const result = await Effect.runPromise(
        V4ConfigParser.parse(config, projectFolder).pipe(
          Effect.provide(V4ConfigParser.Default),
          Effect.provide(NodeContext.layer)
        )
      );

      const main = result.entrypoints.find((entrypoint) => entrypoint.path === 'dist/main.js');
      const health = result.entrypoints.find((entrypoint) => entrypoint.path === 'dist/health.js');

      expect(main).toMatchObject({
        memory: 512,
        package: {
          includeFiles: ['maxmind/**'],
          excludeFiles: ['**/*.map'],
        },
      });
      expect(health?.package).toEqual({
        includeFiles: ['shared/**'],
        excludeFiles: ['**/*.map'],
      });
    });
  });

  it('should collect assets from nested directories', async () => {
    const testFs = makeTestFs({
      '/project/public/index.html': '<html></html>',
      '/project/public/css/style.css': 'body{}',
      '/project/public/images/logo.png': 'png-data',
      '/project/public/images/icons/favicon.ico': 'ico-data',
    });

    const config: ConfigV4 = {
      version: 4,
      assets: 'public',
    };

    const result = await Effect.runPromise(
      V4ConfigParser.parse(config, '/project').pipe(
        Effect.provide(V4ConfigParser.Default),
        Effect.provide(Layer.merge(testFs, TestPathLayer))
      )
    );

    const assets = requireAssets(result);
    expect(requireAssetPaths(result)).toEqual([
      'public/css/style.css',
      'public/images/icons/favicon.ico',
      'public/images/logo.png',
      'public/index.html',
    ]);
    expect(assets.prefixToStrip).toBe('public/');
  });

  it('should filter disallowed asset extensions', async () => {
    const testFs = makeTestFs({
      '/project/public/index.html': '<html></html>',
      '/project/public/.htaccess': 'deny all',
      '/project/public/.htpasswd': 'user:pass',
    });

    const config: ConfigV4 = {
      version: 4,
      assets: 'public',
    };

    const result = await Effect.runPromise(
      V4ConfigParser.parse(config, '/project').pipe(
        Effect.provide(V4ConfigParser.Default),
        Effect.provide(Layer.merge(testFs, TestPathLayer))
      )
    );

    expect(requireAssetPaths(result)).toEqual(['public/index.html']);
  });

  it('should terminate when directory structure contains a symlink loop', async () => {
    // Simulate a symlink loop: a directory entry that always contains another
    // subdirectory with the same name, creating an infinite chain of paths like
    // /project/public/loop/loop/loop/...
    // The depth limit (MAX_ASSET_DEPTH = 100) prevents infinite recursion.
    let readDirCalls = 0;

    const loopFs = Layer.succeed(FileSystem.FileSystem, {
      exists: (p: string) => Effect.succeed(p === '/project/public' || p.startsWith('/project/public/')),
      readFileString: () => Effect.fail(new Error('Not implemented')),
      readDirectory: (p: string) => {
        readDirCalls++;
        if (p === '/project/public' || p.startsWith('/project/public/')) {
          // Every directory contains a file and another directory, simulating a symlink loop
          return Effect.succeed(['file.txt', 'loop']);
        }
        return Effect.succeed([]);
      },
      stat: (p: string) => {
        if (p.endsWith('/file.txt')) {
          return Effect.succeed({ type: 'File' } as unknown as FileSystem.File.Info);
        }
        if (p.endsWith('/loop') || p === '/project/public') {
          return Effect.succeed({ type: 'Directory' } as unknown as FileSystem.File.Info);
        }
        return Effect.fail(new Error(`Not found: ${p}`));
      },
    } as unknown as FileSystem.FileSystem);

    const config: ConfigV4 = {
      version: 4,
      assets: 'public',
    };

    const result = await Effect.runPromise(
      V4ConfigParser.parse(config, '/project').pipe(
        Effect.provide(V4ConfigParser.Default),
        Effect.provide(Layer.merge(loopFs, TestPathLayer))
      )
    );

    // The function should terminate (not hang) and collect files up to the depth limit.
    // With depth limit of 100, we expect 101 readDirectory calls (depth 0 through 100).
    expect(readDirCalls).toBe(101);
    const assetPaths = requireAssetPaths(result);
    expect(assetPaths.length).toBeGreaterThan(0);
    expect(assetPaths.length).toBeLessThanOrEqual(101);
  });
});

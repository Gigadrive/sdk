import { FileSystem } from '@effect/platform';
import { NodeContext } from '@effect/platform-node';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { Effect, Layer } from 'effect';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { AVAILABLE_REGIONS } from '../regions';
import { makeTestFs } from '../test-utils';
import type { ConfigV4 } from '../v4';
import { getFunctionSettings, V4ConfigParser } from './v4-config-parser';

/** Load the example.yaml fixture as a raw object. */
const loadExample = (): Record<string, unknown> => {
  const content = fs.readFileSync(path.join(__dirname, '../v4/example.yaml'), 'utf8');
  return parseYaml(content) as Record<string, unknown>;
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
      Effect.gen(function* () {
        const parser = yield* V4ConfigParser;
        return yield* parser.parse(config, projectFolder);
      }).pipe(Effect.provide(V4ConfigParser.Default), Effect.provide(NodeContext.layer))
    );

    expect(result.regions).toEqual(AVAILABLE_REGIONS);
    expect(result.commands).toEqual(['bun install']);
  });

  it('getFunctionSettings', () => {
    const config = loadExample();

    expect(getFunctionSettings('src/index.ts', config as ConfigV4)).toEqual({
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

    expect(getFunctionSettings('src/cron.ts', config as ConfigV4)).toEqual({
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

    expect(getFunctionSettings('app/test.ts', config as ConfigV4)).toBeUndefined();
    expect(getFunctionSettings('test/index.ts', config as ConfigV4)).toBeUndefined();
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
      Effect.gen(function* () {
        const parser = yield* V4ConfigParser;
        return yield* parser.parse(config, '/project');
      }).pipe(Effect.provide(V4ConfigParser.Default), Effect.provide(testFs))
    );

    expect(result.assets.paths).toEqual([
      'public/css/style.css',
      'public/images/icons/favicon.ico',
      'public/images/logo.png',
      'public/index.html',
    ]);
    expect(result.assets.prefixToStrip).toBe('public/');
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
      Effect.gen(function* () {
        const parser = yield* V4ConfigParser;
        return yield* parser.parse(config, '/project');
      }).pipe(Effect.provide(V4ConfigParser.Default), Effect.provide(testFs))
    );

    expect(result.assets.paths).toEqual(['public/index.html']);
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
      Effect.gen(function* () {
        const parser = yield* V4ConfigParser;
        return yield* parser.parse(config, '/project');
      }).pipe(Effect.provide(V4ConfigParser.Default), Effect.provide(loopFs))
    );

    // The function should terminate (not hang) and collect files up to the depth limit.
    // With depth limit of 100, we expect 101 readDirectory calls (depth 0 through 100).
    expect(readDirCalls).toBe(101);
    expect(result.assets.paths.length).toBeGreaterThan(0);
    expect(result.assets.paths.length).toBeLessThanOrEqual(101);
  });
});

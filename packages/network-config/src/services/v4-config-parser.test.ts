import { NodeContext } from '@effect/platform-node';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { Effect } from 'effect';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { AVAILABLE_REGIONS } from '../regions';
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
});

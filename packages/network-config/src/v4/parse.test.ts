import { NodeContext } from '@effect/platform-node';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { Effect } from 'effect';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, test } from 'vitest';
import { parseConfig } from '../parse-config';
import { AVAILABLE_REGIONS } from '../regions';
import { NetworkConfigLive } from '../services';
import { getFunctionSettings } from '../services/v4-config-parser';
import type { ConfigV4 } from '../v4';
import { schema } from './schema';

/**
 * Thin compat helper: reads a YAML/JSON file using the real filesystem
 * for fixture-based tests that need raw parsed config (not NormalizedConfig).
 */
async function readFixture(filePath: string): Promise<Record<string, unknown>> {
  const content = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') {
    return JSON.parse(content) as Record<string, unknown>;
  }
  const { parse: parseYaml } = await import('yaml');
  return parseYaml(content) as Record<string, unknown>;
}

const createSchemaValidator = () => {
  const schemaFile = fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8');
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  return ajv.compile(JSON.parse(schemaFile));
};

describe('parse config v4', function () {
  test('keeps the published JSON schema aligned with the TypeScript source', function () {
    const schemaFile = fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8');
    expect(JSON.parse(schemaFile)).toEqual(schema);
  });

  test('check if example matches schema', async function () {
    const exampleFile = path.join(__dirname, 'example.yaml');
    const config = await readFixture(exampleFile);

    const schemaFile = fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8');
    const schema = JSON.parse(schemaFile);

    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    const valid = validate(config);

    if (!valid) {
      console.error('Validation errors:', validate.errors);
    }

    expect(valid).toBe(true);
    expect(config).toMatchObject({
      version: 4,
      regions: ['global'],
      build_commands: ['bun install'],
      functions: {
        'src/*.ts': {
          memory: 128,
          max_duration: 15,
          runtime: 'bun-1',
          symlinks: {
            'var/log': '/tmp/logs',
          },
        },
        'src/cron.ts': {
          schedule: 'rate(5 minutes)',
        },
      },
      routes: expect.arrayContaining([
        expect.objectContaining({
          source: '/api/*',
          destination: 'src/api.ts',
        }),
      ]),
      services: {
        redis: null,
        storage: {
          buckets: {
            assets: { visibility: 'public' },
            uploads: null,
          },
        },
      },
    });
  });

  test('check if example passes validation', async function () {
    const exampleFile = path.join(__dirname, 'example.yaml');
    const projectFolder = path.dirname(exampleFile);

    const config = await Effect.runPromise(
      parseConfig(exampleFile, projectFolder).pipe(Effect.provide(NetworkConfigLive), Effect.provide(NodeContext.layer))
    );

    expect(config).toMatchObject({
      regions: AVAILABLE_REGIONS,
      commands: ['bun install'],
      services: [
        { type: 'redis' },
        {
          type: 'storage',
          buckets: [
            { name: 'assets', visibility: 'public' },
            { name: 'uploads', visibility: 'private' },
          ],
        },
      ],
    });
  });

  it('accepts valid File Storage bucket declarations', function () {
    const validate = createSchemaValidator();

    expect(
      validate({
        version: 4,
        services: {
          storage: {
            buckets: {
              assets: null,
              'public-assets': { visibility: 'public' },
              uploads: {},
            },
          },
        },
      })
    ).toBe(true);
  });

  it.each([
    'ab',
    'a'.repeat(64),
    'User-Uploads',
    'user uploads',
    '-uploads',
    'uploads-',
    '0197b2f4-5e70-7f3b-9d5c-555555555555',
  ])('rejects invalid File Storage bucket name %s', function (name) {
    const validate = createSchemaValidator();

    expect(
      validate({
        version: 4,
        services: { storage: { buckets: { [name]: null } } },
      })
    ).toBe(false);
  });

  it('rejects unknown bucket settings and visibility values', function () {
    const validate = createSchemaValidator();

    expect(
      validate({
        version: 4,
        services: { storage: { buckets: { assets: { visibility: 'authenticated' } } } },
      })
    ).toBe(false);
    expect(
      validate({
        version: 4,
        services: { storage: { buckets: { assets: { slug: 'global-assets' } } } },
      })
    ).toBe(false);
  });

  it('accepts invocation durations up to eight hours and rejects larger values', function () {
    const schemaFile = fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8');
    const schema = JSON.parse(schemaFile);
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    const config = {
      version: 4,
      functions: {
        'src/server.ts': {
          max_duration: 28_800,
        },
      },
    };

    expect(validate(config)).toBe(true);
    expect(
      validate({
        ...config,
        functions: { 'src/server.ts': { max_duration: 28_801 } },
      })
    ).toBe(false);
    expect(
      validate({
        ...config,
        functions: { 'src/server.ts': { max_duration: 0 } },
      })
    ).toBe(false);
  });

  test('getFunctionSettings', async () => {
    const exampleFile = path.join(__dirname, 'example.yaml');
    const config = await readFixture(exampleFile);

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
});

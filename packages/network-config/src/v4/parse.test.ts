import { NodeContext } from '@effect/platform-node';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { Effect } from 'effect';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { parseConfig } from '../parse-config';
import { AVAILABLE_REGIONS } from '../regions';
import { NetworkConfigLive } from '../services';
import { getFunctionSettings } from '../services/v4-config-parser';

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

describe('parse config v4', function () {
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
    });
  });

  test('getFunctionSettings', async () => {
    const exampleFile = path.join(__dirname, 'example.yaml');
    const config = await readFixture(exampleFile);

    expect(getFunctionSettings('src/index.ts', config as any)).toEqual({
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

    expect(getFunctionSettings('src/cron.ts', config as any)).toEqual({
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

    expect(getFunctionSettings('app/test.ts', config as any)).toBeUndefined();

    expect(getFunctionSettings('test/index.ts', config as any)).toBeUndefined();
  });
});

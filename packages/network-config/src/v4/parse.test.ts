import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';
import { describe, expect, test } from 'vitest';
import { parseConfig } from '..';
import { parseRawConfig } from '../parse-raw-config';
import { AVAILABLE_REGIONS } from '../regions';
import { getFunctionSettings } from './parse';

describe('parse config v4', function () {
  test('check if example matches schema', async function () {
    // Load the example YAML file
    const exampleFile = path.join(__dirname, 'example.yaml');
    const config = await parseRawConfig(exampleFile);

    // Load the JSON schema
    const schemaFile = fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8');
    const schema = JSON.parse(schemaFile);

    // Set up validator
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);

    // Validate the example against the schema
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

    const config = await parseConfig(exampleFile, projectFolder);

    expect(config).toMatchObject({
      regions: AVAILABLE_REGIONS,
      commands: ['bun install'],
    });
  });

  test('getFunctionSettings', async () => {
    const exampleFile = path.join(__dirname, 'example.yaml');
    const config = await parseRawConfig(exampleFile);

    expect(getFunctionSettings('src/index.ts', config)).toEqual({
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

    expect(getFunctionSettings('src/cron.ts', config)).toEqual({
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

    expect(getFunctionSettings('app/test.ts', config)).toBeUndefined();

    expect(getFunctionSettings('test/index.ts', config)).toBeUndefined();
  });
});

import { NodeContext } from '@effect/platform-node';
import { Effect } from 'effect';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseConfigRaw } from '../parse-config';
import { ConfigModuleLoader } from './config-module-loader';
import { NetworkConfigLive } from './index';

// jiti evaluates modules from the real filesystem, so these tests use a
// temporary directory instead of the in-memory makeTestFs layer.
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gigadrive-config-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const writeFixture = (name: string, contents: string) => {
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, contents);
  return filePath;
};

const load = (filePath: string) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const loader = yield* ConfigModuleLoader;
      return yield* loader.loadConfigModule(filePath);
    }).pipe(Effect.provide(ConfigModuleLoader.Default))
  );

const loadError = (filePath: string) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const loader = yield* ConfigModuleLoader;
      return yield* loader.loadConfigModule(filePath);
    }).pipe(Effect.flip, Effect.provide(ConfigModuleLoader.Default))
  );

describe('ConfigModuleLoader', () => {
  it('should load a config module with a plain object default export', async () => {
    const filePath = writeFixture('gigadrive.ts', `export default { version: 4, regions: ['global'] as const };\n`);
    const result = await load(filePath);
    expect(result).toEqual({ version: 4, regions: ['global'] });
  });

  it('should load a config module wrapped in defineConfig', async () => {
    const defineConfigPath = path.resolve(__dirname, '../define-config.ts');
    const filePath = writeFixture(
      'gigadrive.ts',
      `import { defineConfig } from ${JSON.stringify(defineConfigPath)};\n` +
        `export default defineConfig({ version: 4, regions: ['global'] });\n`
    );
    const result = await load(filePath);
    expect(result).toEqual({ version: 4, regions: ['global'] });
  });

  it('should resolve relative imports inside the config module', async () => {
    writeFixture('regions.ts', `export const regions = ['global'];\n`);
    const filePath = writeFixture(
      'gigadrive.ts',
      `import { regions } from './regions';\nexport default { version: 4, regions };\n`
    );
    const result = await load(filePath);
    expect(result).toEqual({ version: 4, regions: ['global'] });
  });

  it('should load a JavaScript config with an ESM default export', async () => {
    const filePath = writeFixture('gigadrive.mjs', `export default { version: 4, regions: ['global'] };\n`);
    const result = await load(filePath);
    expect(result).toEqual({ version: 4, regions: ['global'] });
  });

  it('should load a CommonJS config exported via module.exports', async () => {
    const filePath = writeFixture('gigadrive.cjs', `module.exports = { version: 4, regions: ['global'] };\n`);
    const result = await load(filePath);
    expect(result).toEqual({ version: 4, regions: ['global'] });
  });

  it('should load a plain .js config in CommonJS style', async () => {
    const filePath = writeFixture('gigadrive.js', `module.exports = { version: 4, regions: ['global'] };\n`);
    const result = await load(filePath);
    expect(result).toEqual({ version: 4, regions: ['global'] });
  });

  it('should fail with ConfigModuleLoadError when a .mjs config is missing the default export', async () => {
    const filePath = writeFixture('gigadrive.mjs', `export const config = { version: 4 };\n`);
    const error = await loadError(filePath);
    expect(error._tag).toBe('ConfigModuleLoadError');
    expect(error.message).toContain('does not have a default export');
  });

  it('should fail with ConfigModuleLoadError for a syntax error', async () => {
    const filePath = writeFixture('gigadrive.ts', `export default { version: 4,,, };\n`);
    const error = await loadError(filePath);
    expect(error._tag).toBe('ConfigModuleLoadError');
    expect(error.filePath).toBe(filePath);
    expect(error.cause).toBeDefined();
  });

  it('should fail with ConfigModuleLoadError for a function default export', async () => {
    const filePath = writeFixture('gigadrive.ts', `export default () => ({ version: 4 });\n`);
    const error = await loadError(filePath);
    expect(error._tag).toBe('ConfigModuleLoadError');
    expect(error.message).toContain('config factories are not supported');
  });

  it('should fail with ConfigModuleLoadError when the default export is missing', async () => {
    const filePath = writeFixture('gigadrive.ts', `export const config = { version: 4 };\n`);
    const error = await loadError(filePath);
    expect(error._tag).toBe('ConfigModuleLoadError');
    expect(error.message).toContain('does not have a default export');
  });

  it('should fail with ConfigModuleLoadError for a non-object default export', async () => {
    const filePath = writeFixture('gigadrive.ts', `export default 'not a config';\n`);
    const error = await loadError(filePath);
    expect(error._tag).toBe('ConfigModuleLoadError');
    expect(error.message).toContain('must default-export a config object');
  });
});

describe('parseConfigRaw with a gigadrive.ts config', () => {
  it('should parse a valid TypeScript config end-to-end', async () => {
    const filePath = writeFixture(
      'gigadrive.ts',
      `export default {\n` +
        `  version: 4,\n` +
        `  regions: ['global'],\n` +
        `  build_commands: ['npm install'],\n` +
        `  routes: [{ source: '/docs/*', destination: 'https://docs.example.com/$1' }],\n` +
        `};\n`
    );

    const config = await Effect.runPromise(
      parseConfigRaw(filePath, tmpDir).pipe(Effect.provide(NetworkConfigLive), Effect.provide(NodeContext.layer))
    );

    expect(config.commands).toEqual(['npm install']);
    expect(config.routes).toEqual([
      expect.objectContaining({ path: '/docs/*', destination: 'https://docs.example.com/$1' }),
    ]);
  });

  it('should fail schema validation for an invalid TypeScript config', async () => {
    const filePath = writeFixture('gigadrive.ts', `export default { version: 4, regions: 'not-an-array' };\n`);

    const error = await Effect.runPromise(
      parseConfigRaw(filePath, tmpDir).pipe(
        Effect.flip,
        Effect.provide(NetworkConfigLive),
        Effect.provide(NodeContext.layer)
      )
    );

    expect(error._tag).toBe('ConfigSchemaValidationError');
  });
});

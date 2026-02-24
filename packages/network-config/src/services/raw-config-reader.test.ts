import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { makeTestFs } from '../test-utils';
import { RawConfigReader } from './raw-config-reader';

const runWithFs = <A, E>(files: Record<string, string>, effect: Effect.Effect<A, E, RawConfigReader>) =>
  Effect.runPromise(effect.pipe(Effect.provide(RawConfigReader.Default), Effect.provide(makeTestFs(files))));

describe('RawConfigReader', () => {
  describe('findConfig', () => {
    it('should find gigadrive.yaml', async () => {
      const result = await runWithFs(
        { '/project/gigadrive.yaml': 'version: 4' },
        Effect.gen(function* () {
          const reader = yield* RawConfigReader;
          return yield* reader.findConfig('/project');
        })
      );
      expect(result).toBe('/project/gigadrive.yaml');
    });

    it('should find nebula.json', async () => {
      const result = await runWithFs(
        { '/project/nebula.json': '{}' },
        Effect.gen(function* () {
          const reader = yield* RawConfigReader;
          return yield* reader.findConfig('/project');
        })
      );
      expect(result).toBe('/project/nebula.json');
    });

    it('should return null when no config found', async () => {
      const result = await runWithFs(
        {},
        Effect.gen(function* () {
          const reader = yield* RawConfigReader;
          return yield* reader.findConfig('/project');
        })
      );
      expect(result).toBeNull();
    });

    it('should prefer gigadrive.yaml over nebula.yaml', async () => {
      const result = await runWithFs(
        { '/project/gigadrive.yaml': 'version: 4', '/project/nebula.yaml': 'version: 4' },
        Effect.gen(function* () {
          const reader = yield* RawConfigReader;
          return yield* reader.findConfig('/project');
        })
      );
      expect(result).toBe('/project/gigadrive.yaml');
    });
  });

  describe('readRawConfig', () => {
    it('should parse JSON config file', async () => {
      const result = await runWithFs(
        { '/project/config.json': JSON.stringify({ version: 4, name: 'test-json' }) },
        Effect.gen(function* () {
          const reader = yield* RawConfigReader;
          return yield* reader.readRawConfig('/project/config.json');
        })
      );
      expect(result).toEqual({ version: 4, name: 'test-json' });
    });

    it('should parse YAML config file with .yaml extension', async () => {
      const result = await runWithFs(
        { '/project/config.yaml': 'version: 4\nname: test-yaml' },
        Effect.gen(function* () {
          const reader = yield* RawConfigReader;
          return yield* reader.readRawConfig('/project/config.yaml');
        })
      );
      expect(result).toEqual({ version: 4, name: 'test-yaml' });
    });

    it('should parse YAML config file with .yml extension', async () => {
      const result = await runWithFs(
        { '/project/config.yml': 'version: 4\nname: test-yml' },
        Effect.gen(function* () {
          const reader = yield* RawConfigReader;
          return yield* reader.readRawConfig('/project/config.yml');
        })
      );
      expect(result).toEqual({ version: 4, name: 'test-yml' });
    });

    it('should parse unknown file as YAML by default', async () => {
      const result = await runWithFs(
        { '/project/config.txt': 'version: 4\nname: test-unknown' },
        Effect.gen(function* () {
          const reader = yield* RawConfigReader;
          return yield* reader.readRawConfig('/project/config.txt');
        })
      );
      expect(result).toEqual({ version: 4, name: 'test-unknown' });
    });

    it('should fail with ConfigFileNotFoundError for non-existent file', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const reader = yield* RawConfigReader;
          return yield* reader.readRawConfig('/project/missing.json');
        }).pipe(
          Effect.catchTag('ConfigFileNotFoundError', (err) =>
            Effect.succeed({ _tag: 'caught' as const, filePath: err.filePath })
          ),
          Effect.provide(RawConfigReader.Default),
          Effect.provide(makeTestFs({}))
        )
      );
      expect(result).toMatchObject({ _tag: 'caught', filePath: '/project/missing.json' });
    });

    it('should fail with ConfigFileEmptyError for empty file', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const reader = yield* RawConfigReader;
          return yield* reader.readRawConfig('/project/config.yaml');
        }).pipe(
          Effect.catchTag('ConfigFileEmptyError', (err) =>
            Effect.succeed({ _tag: 'caught' as const, filePath: err.filePath })
          ),
          Effect.provide(RawConfigReader.Default),
          Effect.provide(makeTestFs({ '/project/config.yaml': '' }))
        )
      );
      expect(result).toMatchObject({ _tag: 'caught', filePath: '/project/config.yaml' });
    });

    it('should fail with ConfigFileParseError for invalid JSON', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const reader = yield* RawConfigReader;
          return yield* reader.readRawConfig('/project/config.json');
        }).pipe(
          Effect.catchTag('ConfigFileParseError', (err) =>
            Effect.succeed({ _tag: 'caught' as const, filePath: err.filePath })
          ),
          Effect.provide(RawConfigReader.Default),
          Effect.provide(makeTestFs({ '/project/config.json': '{ invalid json' }))
        )
      );
      expect(result).toMatchObject({ _tag: 'caught', filePath: '/project/config.json' });
    });

    it('should fail with ConfigVersionError for missing version', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const reader = yield* RawConfigReader;
          return yield* reader.readRawConfig('/project/config.yaml');
        }).pipe(
          Effect.catchTag('ConfigVersionError', (err) =>
            Effect.succeed({ _tag: 'caught' as const, filePath: err.filePath })
          ),
          Effect.provide(RawConfigReader.Default),
          Effect.provide(makeTestFs({ '/project/config.yaml': 'name: test-no-version' }))
        )
      );
      expect(result).toMatchObject({ _tag: 'caught', filePath: '/project/config.yaml' });
    });

    it('should not fail for missing version when disableVersionCheck is true', async () => {
      const result = await runWithFs(
        { '/project/config.yaml': 'name: test-no-version' },
        Effect.gen(function* () {
          const reader = yield* RawConfigReader;
          return yield* reader.readRawConfig('/project/config.yaml', { disableVersionCheck: true });
        })
      );
      expect(result).toEqual({ name: 'test-no-version' });
    });
  });

  describe('readConfigFile', () => {
    it('should return null if file does not exist', async () => {
      const result = await runWithFs(
        {},
        Effect.gen(function* () {
          const reader = yield* RawConfigReader;
          return yield* reader.readConfigFile('/path/to/nonexistent.json');
        })
      );
      expect(result).toBeNull();
    });

    it('should parse JSON config file correctly', async () => {
      const mockConfig = { version: 3, name: 'test-config' };
      const result = await runWithFs(
        { '/path/to/config.json': JSON.stringify(mockConfig) },
        Effect.gen(function* () {
          const reader = yield* RawConfigReader;
          return yield* reader.readConfigFile<typeof mockConfig>('/path/to/config.json');
        })
      );
      expect(result).toEqual(mockConfig);
    });

    it('should parse YAML config file correctly', async () => {
      const result = await runWithFs(
        { '/path/to/config.yaml': 'version: 3\nname: test-config' },
        Effect.gen(function* () {
          const reader = yield* RawConfigReader;
          return yield* reader.readConfigFile('/path/to/config.yaml');
        })
      );
      expect(result).toEqual({ version: 3, name: 'test-config' });
    });

    it('should disable version check when parsing', async () => {
      const result = await runWithFs(
        { '/path/to/config.json': JSON.stringify({ name: 'no-version-config' }) },
        Effect.gen(function* () {
          const reader = yield* RawConfigReader;
          return yield* reader.readConfigFile('/path/to/config.json');
        })
      );
      expect(result).toEqual({ name: 'no-version-config' });
    });
  });
});

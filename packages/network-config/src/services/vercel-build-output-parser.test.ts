import { Effect, Layer } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import type { NormalizedConfig } from '../normalized-config';
import { makeTestFs, TestPathLayer } from '../test-utils';
import { RawConfigReader } from './raw-config-reader';
import { VercelBuildOutputParser } from './vercel-build-output-parser';

// Mock getFilesForPattern to avoid real filesystem access
const { mockGetFilesForPattern } = vi.hoisted(() => ({
  mockGetFilesForPattern: vi.fn().mockResolvedValue([]),
}));
vi.mock('@gigadrive/build-utils', () => ({
  getFilesForPattern: mockGetFilesForPattern,
}));

const emptyConfig: NormalizedConfig = {
  regions: ['us-east-1'],
  environmentVariables: {},
  commands: [],
  entrypoints: [],
  routes: [],
  warnings: [],
  errors: [],
};

const runParser = (files: Record<string, string>, config: NormalizedConfig, projectFolder: string) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const parser = yield* VercelBuildOutputParser;
      return yield* parser.parse(config, projectFolder);
    }).pipe(
      Effect.provide(VercelBuildOutputParser.Default),
      Effect.provide(RawConfigReader.Default),
      Effect.provide(Layer.merge(makeTestFs(files), TestPathLayer))
    )
  );

describe('VercelBuildOutputParser', () => {
  it('should return parseResult unchanged when no vercel output exists', async () => {
    const result = await runParser({}, emptyConfig, '/project');
    expect(result).toEqual(emptyConfig);
  });

  it('should return parseResult unchanged when config version is less than 3', async () => {
    const result = await runParser(
      { '/project/.vercel/output/config.json': JSON.stringify({ version: 2 }) },
      emptyConfig,
      '/project'
    );
    expect(result).toEqual(emptyConfig);
  });

  it('should return parseResult unchanged when config version is missing', async () => {
    const result = await runParser(
      { '/project/.vercel/output/config.json': JSON.stringify({ routes: [] }) },
      emptyConfig,
      '/project'
    );
    expect(result).toEqual(emptyConfig);
  });

  it('should return parseResult unchanged when config version is not a number', async () => {
    const result = await runParser(
      { '/project/.vercel/output/config.json': JSON.stringify({ version: '3' }) },
      emptyConfig,
      '/project'
    );
    expect(result).toEqual(emptyConfig);
  });

  it('should not mutate the input parseResult errors array', async () => {
    const inputConfig: NormalizedConfig = {
      ...emptyConfig,
      errors: ['existing-error'],
    };
    const originalErrors = [...inputConfig.errors];

    // No vercel output → loadFunctions not called, no mutations possible
    await runParser({}, inputConfig, '/project');

    expect(inputConfig.errors).toEqual(originalErrors);
  });

  it('should deduplicate regions when function regions overlap with parseResult regions', async () => {
    mockGetFilesForPattern.mockResolvedValueOnce(['.vercel/output/functions/api/hello.func/.vc-config.json']);

    const vercelConfig = { version: 3 };
    const functionConfig = {
      handler: 'index.js',
      runtime: 'nodejs20.x',
      regions: ['iad1'], // translates to us-east-1, which is already in parseResult
      filePathMap: { 'index.js': 'index.js' },
    };

    const inputConfig: NormalizedConfig = {
      ...emptyConfig,
      regions: ['us-east-1'],
    };

    const result = await runParser(
      {
        '/project/.vercel/output/config.json': JSON.stringify(vercelConfig),
        '/project/.vercel/output/functions/api/hello.func/.vc-config.json': JSON.stringify(functionConfig),
      },
      inputConfig,
      '/project'
    );

    // us-east-1 appears in both parseResult and the translated function region (iad1 → us-east-1)
    // It should appear only once after deduplication
    expect(result.regions).toEqual(['us-east-1']);
  });

  it('should merge asset overrides from vercel config', async () => {
    const vercelConfig = {
      version: 3,
      overrides: { 'index.html': { contentType: 'text/html' } },
    };

    const result = await runParser(
      { '/project/.vercel/output/config.json': JSON.stringify(vercelConfig) },
      emptyConfig,
      '/project'
    );

    expect(result.assets?.overrides).toEqual({
      'index.html': { contentType: 'text/html' },
    });
  });
});

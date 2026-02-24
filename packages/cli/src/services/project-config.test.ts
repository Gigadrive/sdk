import { FileSystem } from '@effect/platform';
import { Effect, Layer, Logger, LogLevel } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectConfigService } from './project-config';

// ---------------------------------------------------------------------------
// Mock @gigadrive/network-config — keep real service classes, mock functions
// ---------------------------------------------------------------------------

vi.mock('@gigadrive/network-config', async (importOriginal) => {
  const original = await importOriginal<typeof import('@gigadrive/network-config')>();
  return {
    ...original,
    parseConfig: vi.fn(),
    postProcessConfig: vi.fn(),
    detectFramework: vi.fn(),
    mergeWithFrameworkDefaults: vi.fn(),
  };
});

import {
  detectFramework,
  mergeWithFrameworkDefaults,
  parseConfig,
  postProcessConfig,
  RawConfigReader,
} from '@gigadrive/network-config';

const mockedParseConfig = vi.mocked(parseConfig);
const mockedDetectFramework = vi.mocked(detectFramework);
const mockedPostProcessConfig = vi.mocked(postProcessConfig);
const mockedMergeWithFrameworkDefaults = vi.mocked(mergeWithFrameworkDefaults);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Provide a stub FileSystem for detectFramework (which requires it in production,
// but here the whole function is mocked so it's never actually used)
const StubFileSystem = Layer.succeed(FileSystem.FileSystem, {} as FileSystem.FileSystem);

// Stub RawConfigReader — we control what findConfig returns per-test
let findConfigResult: string | null = null;

const StubRawConfigReader = Layer.succeed(RawConfigReader, {
  findConfig: () => Effect.succeed(findConfigResult),
  readRawConfig: () => Effect.succeed({}),
  readConfigFile: () => Effect.succeed(null),
} as any);

const ProjectConfigLive = Layer.provide(ProjectConfigService.Default, StubRawConfigReader);

const TestLayer = Layer.mergeAll(ProjectConfigLive, Logger.minimumLogLevel(LogLevel.None)).pipe(
  Layer.provideMerge(StubFileSystem)
);

const runEffect = <A, E>(effect: Effect.Effect<A, E, ProjectConfigService>) =>
  Effect.runPromise(Effect.provide(effect, TestLayer));

// Helper: make detectFramework return a "not detected" Effect
const mockNoFrameworkDetected = () => {
  mockedDetectFramework.mockReturnValue(
    Effect.fail({ _tag: 'FrameworkNotDetectedError', message: 'No framework detected', directory: '/project' }) as any
  );
};

// Helper: make detectFramework return a detected framework
const mockFrameworkDetected = (slug = 'nextjs', name = 'Next.js') => {
  mockedDetectFramework.mockReturnValue(
    Effect.succeed({
      framework: { slug, name },
      packageManager: 'npm',
      config: {
        warnings: [`Auto-detected framework: ${name}. Create a gigadrive.yaml to customize.`],
        errors: [],
        commands: ['npm install', 'next build'],
        entrypoints: [{ path: '.next/standalone/server.js', runtime: 'node-22', memory: 256, maxDuration: 30 }],
        routes: [{ path: '/*', destination: '.next/standalone/server.js', handler: 'SERVERLESS_FUNCTION' }],
        regions: ['us-east-1'],
        environmentVariables: { NODE_ENV: 'production' },
      },
    }) as any
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProjectConfigService.resolve', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    findConfigResult = null;
  });

  it('should fail with ConfigNotFoundError when no config file and no framework detected', async () => {
    findConfigResult = null;
    mockNoFrameworkDetected();

    const result = await runEffect(
      ProjectConfigService.resolve('/project').pipe(
        Effect.catchTag('ConfigNotFoundError', (err) =>
          Effect.succeed({ _tag: 'caught' as const, message: err.message, directory: err.directory })
        )
      )
    );

    expect(result).toMatchObject({
      _tag: 'caught',
      directory: '/project',
    });
  });

  it('should return config and configPath when config file is valid and no framework detected', async () => {
    findConfigResult = '/project/gigadrive.yaml';
    mockedParseConfig.mockReturnValue(
      Effect.succeed({
        warnings: [],
        errors: [],
        name: 'test-app',
      }) as any
    );
    mockNoFrameworkDetected();

    const result = await runEffect(ProjectConfigService.resolve('/project'));

    expect(result).toMatchObject({
      config: { warnings: [], errors: [], name: 'test-app' },
      configPath: '/project/gigadrive.yaml',
    });
  });

  it('should fail with ConfigParseError when parseConfig fails', async () => {
    findConfigResult = '/project/gigadrive.yaml';
    mockedParseConfig.mockReturnValue(
      Effect.fail({
        _tag: 'ConfigFileParseError',
        message: 'YAML syntax error',
        filePath: '/project/gigadrive.yaml',
      }) as any
    );
    mockNoFrameworkDetected();

    const result = await runEffect(
      ProjectConfigService.resolve('/project').pipe(
        Effect.catchTag('ConfigParseError', (err) =>
          Effect.succeed({ _tag: 'caught' as const, message: err.message, cause: err.cause })
        )
      )
    );

    expect(result).toMatchObject({
      _tag: 'caught',
      message: 'Failed to parse config file',
      cause: 'YAML syntax error',
    });
  });

  it('should fail with ConfigValidationError when config has errors', async () => {
    findConfigResult = '/project/gigadrive.yaml';
    mockedParseConfig.mockReturnValue(
      Effect.succeed({
        warnings: [],
        errors: ['Invalid region', 'Missing name'],
        name: 'test-app',
      }) as any
    );
    mockNoFrameworkDetected();

    const result = await runEffect(
      ProjectConfigService.resolve('/project').pipe(
        Effect.catchTag('ConfigValidationError', (err) =>
          Effect.succeed({ _tag: 'caught' as const, errors: err.errors })
        )
      )
    );

    expect(result).toMatchObject({
      _tag: 'caught',
      errors: ['Invalid region', 'Missing name'],
    });
  });

  it('should still return config when there are warnings but no errors', async () => {
    findConfigResult = '/project/gigadrive.yaml';
    mockedParseConfig.mockReturnValue(
      Effect.succeed({
        warnings: ['Deprecated option used'],
        errors: [],
        name: 'test-app',
      }) as any
    );
    mockNoFrameworkDetected();

    const result = await runEffect(ProjectConfigService.resolve('/project'));

    expect(result.config.warnings).toEqual(['Deprecated option used']);
  });

  it('should use auto-detected framework config when no config file exists', async () => {
    findConfigResult = null;
    mockFrameworkDetected();
    mockedPostProcessConfig.mockReturnValue(
      Effect.succeed({
        warnings: ['Auto-detected framework: Next.js. Create a gigadrive.yaml to customize.'],
        errors: [],
        commands: ['npm install', 'next build'],
        entrypoints: [{ path: '.next/standalone/server.js', runtime: 'node-22', memory: 256, maxDuration: 30 }],
        routes: [],
        regions: ['us-east-1'],
        environmentVariables: {},
      }) as any
    );

    const result = await runEffect(ProjectConfigService.resolve('/project'));

    expect(result.configPath).toBeNull();
    expect(result.framework).toEqual({ name: 'Next.js', slug: 'nextjs' });
    expect(mockedPostProcessConfig).toHaveBeenCalled();
  });

  it('should merge framework defaults with user config when both exist', async () => {
    findConfigResult = '/project/gigadrive.yaml';
    mockFrameworkDetected();

    const userConfig = {
      warnings: [],
      errors: [],
      commands: ['npm run build'],
      entrypoints: [],
      routes: [],
      regions: ['us-east-1'],
      environmentVariables: {},
    };

    const mergedConfig = {
      warnings: ['Auto-detected framework: Next.js. Create a gigadrive.yaml to customize.'],
      errors: [],
      commands: ['npm run build'],
      entrypoints: [{ path: '.next/standalone/server.js', runtime: 'node-22', memory: 256, maxDuration: 30 }],
      routes: [],
      regions: ['us-east-1'],
      environmentVariables: { NODE_ENV: 'production' },
    };

    mockedParseConfig.mockReturnValue(Effect.succeed(userConfig) as any);
    mockedMergeWithFrameworkDefaults.mockReturnValue(Effect.succeed(mergedConfig) as any);

    const result = await runEffect(ProjectConfigService.resolve('/project'));

    expect(result.configPath).toBe('/project/gigadrive.yaml');
    expect(result.framework).toEqual({ name: 'Next.js', slug: 'nextjs' });
    expect(mockedMergeWithFrameworkDefaults).toHaveBeenCalled();
  });
});

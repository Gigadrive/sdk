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
  NetworkConfigLive,
  parseConfig,
  postProcessConfig,
} from '@gigadrive/network-config';

const mockedParseConfig = vi.mocked(parseConfig);
const mockedDetectFramework = vi.mocked(detectFramework);
const mockedPostProcessConfig = vi.mocked(postProcessConfig);
const mockedMergeWithFrameworkDefaults = vi.mocked(mergeWithFrameworkDefaults);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Control which files exist in the stub filesystem. RawConfigReader.findConfig
// iterates over ALLOWED_CONFIG_NAMES and calls fs.exists for each.
let existingFiles: Set<string> = new Set();

const StubFileSystem = Layer.succeed(FileSystem.FileSystem, {
  exists: (filePath: string) => Effect.succeed(existingFiles.has(filePath)),
  readFileString: () => Effect.fail(new Error('Not implemented in test stub')),
  stat: () => Effect.fail(new Error('Not implemented in test stub')),
  readDirectory: () => Effect.succeed([]),
} as unknown as FileSystem.FileSystem);

// ProjectConfigService.Default includes NetworkConfigLive via dependencies,
// which needs FileSystem.FileSystem. We provide StubFileSystem to satisfy it.
// NetworkConfigLive is also merged so its services (RawConfigReader, SchemaValidator, etc.)
// are available for the runtime effects called by resolve (parseConfig, postProcessConfig).
const TestLayer = Layer.mergeAll(
  ProjectConfigService.Default,
  NetworkConfigLive,
  Logger.minimumLogLevel(LogLevel.None)
).pipe(Layer.provideMerge(StubFileSystem));

const runEffect = <A, E>(effect: Effect.Effect<A, E, Layer.Layer.Success<typeof TestLayer>>) =>
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
    existingFiles = new Set();
  });

  it('should fail with ConfigNotFoundError when no config file and no framework detected', async () => {
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
    existingFiles.add('/project/gigadrive.yaml');
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
    existingFiles.add('/project/gigadrive.yaml');
    mockedParseConfig.mockReturnValue(
      Effect.fail({
        _tag: 'ConfigFileParseError',
        message: 'YAML syntax error',
        filePath: '/project/gigadrive.yaml',
        cause: 'invalid character at line 3',
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
      message: 'YAML syntax error',
      cause: 'invalid character at line 3',
    });
  });

  it('should fail with ConfigValidationError when config has errors', async () => {
    existingFiles.add('/project/gigadrive.yaml');
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
    existingFiles.add('/project/gigadrive.yaml');
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
    existingFiles.add('/project/gigadrive.yaml');
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

import { Effect, Layer, Logger, LogLevel } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectConfigService } from './project-config';

// ---------------------------------------------------------------------------
// Mock @gigadrive/network-config
// ---------------------------------------------------------------------------

vi.mock('@gigadrive/network-config', () => ({
  findConfig: vi.fn(),
  parseConfig: vi.fn(),
}));

import { findConfig, parseConfig } from '@gigadrive/network-config';

const mockedFindConfig = vi.mocked(findConfig);
const mockedParseConfig = vi.mocked(parseConfig);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TestLayer = Layer.mergeAll(ProjectConfigService.Default, Logger.minimumLogLevel(LogLevel.None));

const runEffect = <A, E>(effect: Effect.Effect<A, E, ProjectConfigService>) =>
  Effect.runPromise(Effect.provide(effect, TestLayer));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProjectConfigService.resolve', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fail with ConfigNotFoundError when no config file is found', async () => {
    mockedFindConfig.mockReturnValue(null as any);

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
    expect(mockedFindConfig).toHaveBeenCalledWith('/project');
  });

  it('should return config and configPath when config is valid', async () => {
    mockedFindConfig.mockReturnValue('/project/gigadrive.yaml');
    mockedParseConfig.mockResolvedValue({
      warnings: [],
      errors: [],
      name: 'test-app',
    } as any);

    const result = await runEffect(ProjectConfigService.resolve('/project'));

    expect(result).toEqual({
      config: { warnings: [], errors: [], name: 'test-app' },
      configPath: '/project/gigadrive.yaml',
    });
    expect(mockedParseConfig).toHaveBeenCalledWith('/project/gigadrive.yaml', '/project');
  });

  it('should fail with ConfigParseError when parseConfig throws', async () => {
    mockedFindConfig.mockReturnValue('/project/gigadrive.yaml');
    mockedParseConfig.mockRejectedValue(new Error('YAML syntax error'));

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
    mockedFindConfig.mockReturnValue('/project/gigadrive.yaml');
    mockedParseConfig.mockResolvedValue({
      warnings: [],
      errors: ['Invalid region', 'Missing name'],
      name: 'test-app',
    } as any);

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
    mockedFindConfig.mockReturnValue('/project/gigadrive.yaml');
    mockedParseConfig.mockResolvedValue({
      warnings: ['Deprecated option used'],
      errors: [],
      name: 'test-app',
    } as any);

    const result = await runEffect(ProjectConfigService.resolve('/project'));

    expect(result.config.warnings).toEqual(['Deprecated option used']);
  });
});

import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { AVAILABLE_REGIONS } from '../regions';
import { generateConfig } from './generate-config';
import type { FrameworkDefinition } from './types';

const mockFramework: FrameworkDefinition = {
  slug: 'test-framework',
  name: 'Test Framework',
  language: 'node',
  detectors: [{ matchPackage: 'test-fw' }],
  priority: 50,
  getDefaultConfig: () => ({
    runtime: 'node-22',
    memory: 256,
    maxDuration: 30,
    streaming: true,
    commands: ['test-fw build'],
    entrypoint: 'dist/main.js',
    assetsDir: 'public',
    populateAssetCache: true,
    routes: [{ source: '/*', destination: 'dist/main.js' }],
    environmentVariables: { NODE_ENV: 'production' },
  }),
};

describe('generateConfig', () => {
  it('should generate a NormalizedConfig with npm install prepended', async () => {
    const result = await Effect.runPromise(generateConfig(mockFramework, 'npm'));

    expect(result.commands).toEqual(['npm install', 'test-fw build']);
    expect(result.entrypoints).toHaveLength(1);
    expect(result.entrypoints[0].path).toBe('dist/main.js');
    expect(result.entrypoints[0].runtime).toBe('node-22');
    expect(result.entrypoints[0].memory).toBe(256);
    expect(result.entrypoints[0].maxDuration).toBe(30);
    expect(result.entrypoints[0].streaming).toBe(true);
  });

  it('should prepend pnpm install for pnpm', async () => {
    const result = await Effect.runPromise(generateConfig(mockFramework, 'pnpm'));
    expect(result.commands[0]).toBe('pnpm install');
  });

  it('should prepend bun install for bun', async () => {
    const result = await Effect.runPromise(generateConfig(mockFramework, 'bun'));
    expect(result.commands[0]).toBe('bun install');
  });

  it('should prepend yarn install for yarn', async () => {
    const result = await Effect.runPromise(generateConfig(mockFramework, 'yarn'));
    expect(result.commands[0]).toBe('yarn install');
  });

  it('should prepend composer install for composer', async () => {
    const result = await Effect.runPromise(generateConfig(mockFramework, 'composer'));
    expect(result.commands[0]).toBe('composer install');
  });

  it('should set all available regions', async () => {
    const result = await Effect.runPromise(generateConfig(mockFramework, 'npm'));
    expect(result.regions).toEqual([...AVAILABLE_REGIONS]);
  });

  it('should include a warning about auto-detection', async () => {
    const result = await Effect.runPromise(generateConfig(mockFramework, 'npm'));
    expect(result.warnings).toContain('Auto-detected framework: Test Framework. Create a gigadrive.yaml to customize.');
  });

  it('should set up assets when assetsDir is provided', async () => {
    const result = await Effect.runPromise(generateConfig(mockFramework, 'npm'));
    expect(result.assets).toEqual({
      paths: [],
      prefixToStrip: 'public/',
      dynamicRoutes: true,
      populateCache: true,
    });
  });

  it('should not set assets when assetsDir is not provided', async () => {
    const noAssetsFramework: FrameworkDefinition = {
      ...mockFramework,
      getDefaultConfig: () => ({
        runtime: 'node-22',
        memory: 128,
        maxDuration: 30,
        streaming: true,
        commands: [],
        entrypoint: 'src/index.ts',
        routes: [{ source: '/*', destination: 'src/index.ts' }],
        environmentVariables: {},
      }),
    };

    const result = await Effect.runPromise(generateConfig(noAssetsFramework, 'npm'));
    expect(result.assets).toBeUndefined();
  });

  it('should generate routes with SERVERLESS_FUNCTION_STREAMING handler when streaming is true', async () => {
    const result = await Effect.runPromise(generateConfig(mockFramework, 'npm'));
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0].path).toBe('/*');
    expect(result.routes[0].destination).toBe('dist/main.js');
    expect(result.routes[0].handler).toBe('SERVERLESS_FUNCTION_STREAMING');
    expect(result.routes[0].methods).toEqual(['ANY']);
  });

  it('should generate routes with SERVERLESS_FUNCTION handler when streaming is false', async () => {
    const nonStreamingFramework: FrameworkDefinition = {
      ...mockFramework,
      getDefaultConfig: () => ({
        ...mockFramework.getDefaultConfig('npm'),
        streaming: false,
      }),
    };

    const result = await Effect.runPromise(generateConfig(nonStreamingFramework, 'npm'));
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0].handler).toBe('SERVERLESS_FUNCTION');
  });

  it('should include environment variables', async () => {
    const result = await Effect.runPromise(generateConfig(mockFramework, 'npm'));
    expect(result.environmentVariables).toEqual({ NODE_ENV: 'production' });
  });

  it('should include excludeFiles when provided', async () => {
    const frameworkWithExcludes: FrameworkDefinition = {
      ...mockFramework,
      getDefaultConfig: () => ({
        ...mockFramework.getDefaultConfig('npm'),
        excludeFiles: ['tests/', 'storage/', '.ddev', 'node_modules/'],
      }),
    };

    const result = await Effect.runPromise(generateConfig(frameworkWithExcludes, 'npm'));
    expect(result.excludeFiles).toEqual(['tests/', 'storage/', '.ddev', 'node_modules/']);
  });

  it('should not set excludeFiles when not provided', async () => {
    const result = await Effect.runPromise(generateConfig(mockFramework, 'npm'));
    expect(result.excludeFiles).toBeUndefined();
  });

  it('should use custom installCommand when provided', async () => {
    const customInstallFramework: FrameworkDefinition = {
      ...mockFramework,
      getDefaultConfig: () => ({
        ...mockFramework.getDefaultConfig('npm'),
        installCommand: 'composer install --prefer-dist --optimize-autoloader --no-dev',
        commands: ['bun install', 'bun run build'],
      }),
    };

    const result = await Effect.runPromise(generateConfig(customInstallFramework, 'composer'));
    expect(result.commands[0]).toBe('composer install --prefer-dist --optimize-autoloader --no-dev');
    expect(result.commands).not.toContain('composer install');
  });

  it('should not produce duplicate install commands for Symfony', async () => {
    const { symfony } = await import('./frameworks/symfony');
    const result = await Effect.runPromise(generateConfig(symfony, 'composer'));

    // installCommand overrides the default 'composer install'
    const composerInstallCount = result.commands.filter((c) => c.startsWith('composer install')).length;
    expect(composerInstallCount).toBe(1);
    expect(result.commands[0]).toBe('composer install --prefer-dist --optimize-autoloader --no-dev');
  });

  it('should generate empty entrypoints and routes when entrypoint is not provided', async () => {
    const staticFramework: FrameworkDefinition = {
      ...mockFramework,
      getDefaultConfig: () => ({
        runtime: 'node-22',
        memory: 128,
        maxDuration: 30,
        streaming: false,
        commands: ['vite build'],
        assetsDir: 'dist',
        populateAssetCache: true,
        routes: [],
        environmentVariables: { NODE_ENV: 'production' },
      }),
    };

    const result = await Effect.runPromise(generateConfig(staticFramework, 'npm'));
    expect(result.entrypoints).toEqual([]);
    expect(result.routes).toEqual([]);
    expect(result.assets).toBeDefined();
  });
});

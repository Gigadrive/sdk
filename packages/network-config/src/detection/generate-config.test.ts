import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import { AVAILABLE_REGIONS } from '../regions';
import { makeTestFs, TestPathLayer } from '../test-utils';
import { generateConfig } from './generate-config';
import type { FrameworkDefaultConfig, FrameworkDefinition, PackageManager } from './types';

/**
 * Runs generateConfig against an in-memory project so `assetsDir` resolves
 * against real (fake) build output.
 */
const generate = (
  framework: FrameworkDefinition,
  packageManager: PackageManager,
  files: Record<string, string> = {},
  refinedDefaults?: FrameworkDefaultConfig
) =>
  Effect.runPromise(
    generateConfig(framework, packageManager, '/project', refinedDefaults).pipe(
      Effect.provide(Layer.merge(makeTestFs(files), TestPathLayer))
    )
  );

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
    const result = await generate(mockFramework, 'npm');

    expect(result.commands).toEqual(['npm install', 'test-fw build']);
    expect(result.entrypoints).toHaveLength(1);
    expect(result.entrypoints[0].path).toBe('dist/main.js');
    expect(result.entrypoints[0].runtime).toBe('node-22');
    expect(result.entrypoints[0].memory).toBe(256);
    expect(result.entrypoints[0].maxDuration).toBe(30);
    expect(result.entrypoints[0].streaming).toBe(true);
  });

  it('should prepend pnpm install for pnpm', async () => {
    const result = await generate(mockFramework, 'pnpm');
    expect(result.commands[0]).toBe('pnpm install');
  });

  it('should prepend bun install for bun', async () => {
    const result = await generate(mockFramework, 'bun');
    expect(result.commands[0]).toBe('bun install');
  });

  it('should prepend yarn install for yarn', async () => {
    const result = await generate(mockFramework, 'yarn');
    expect(result.commands[0]).toBe('yarn install');
  });

  it('should prepend composer install for composer', async () => {
    const result = await generate(mockFramework, 'composer');
    expect(result.commands[0]).toBe('composer install');
  });

  it('should set all available regions', async () => {
    const result = await generate(mockFramework, 'npm');
    expect(result.regions).toEqual([...AVAILABLE_REGIONS]);
  });

  it('should include a warning about auto-detection', async () => {
    const result = await generate(mockFramework, 'npm');
    expect(result.warnings).toContain('Auto-detected framework: Test Framework. Create a gigadrive.yaml to customize.');
  });

  it('should set up assets when assetsDir is provided', async () => {
    const result = await generate(mockFramework, 'npm');
    expect(result.assets).toEqual({
      paths: [],
      prefixToStrip: 'public/',
      dynamicRoutes: true,
      populateCache: true,
    });
  });

  it('should publish every file inside assetsDir', async () => {
    const result = await generate(mockFramework, 'npm', {
      '/project/public/index.html': '<html></html>',
      '/project/public/assets/app.css': 'body{}',
      '/project/public/assets/app.js': 'console.log(1)',
      '/project/src/main.ts': 'ignored',
    });

    expect(result.assets?.paths).toEqual(['public/assets/app.css', 'public/assets/app.js', 'public/index.html']);
    expect(result.assets?.prefixToStrip).toBe('public/');
  });

  it('should skip server configuration files inside assetsDir', async () => {
    const result = await generate(mockFramework, 'npm', {
      '/project/public/index.html': '<html></html>',
      '/project/public/.htaccess': 'RewriteEngine On',
      '/project/public/.htpasswd': 'user:hash',
    });

    expect(result.assets?.paths).toEqual(['public/index.html']);
  });

  it('should leave assets empty when the build output directory is missing', async () => {
    const result = await generate(mockFramework, 'npm', { '/project/package.json': '{}' });

    expect(result.assets?.paths).toEqual([]);
  });

  it('should not enumerate assetsDir when the framework resolved its own asset paths', async () => {
    const framework: FrameworkDefinition = {
      ...mockFramework,
      getDefaultConfig: () => ({
        ...mockFramework.getDefaultConfig('npm'),
        assetsPrefixToStrip: '',
        assetPaths: ['public/only-this.html'],
      }),
    };

    const result = await generate(framework, 'npm', {
      '/project/public/only-this.html': '<html></html>',
      '/project/public/not-declared.html': '<html></html>',
    });

    expect(result.assets?.paths).toEqual(['public/only-this.html']);
  });

  it('should serve directory index files at their extensionless path for static-only output', async () => {
    const staticFramework: FrameworkDefinition = {
      ...mockFramework,
      getDefaultConfig: () => ({
        ...mockFramework.getDefaultConfig('npm'),
        entrypoint: undefined,
        assetsDir: 'dist',
        routes: [],
      }),
    };

    const result = await generate(staticFramework, 'npm', {
      '/project/dist/index.html': '<html></html>',
      '/project/dist/about/index.html': '<html></html>',
      '/project/dist/404.html': '<html></html>',
      '/project/dist/assets/app.js': 'console.log(1)',
    });

    expect(result.entrypoints).toEqual([]);
    expect(result.assets?.prefixToStrip).toBe('dist/');
    expect(result.assets?.paths).toEqual([
      'dist/404.html',
      'dist/about/index.html',
      'dist/assets/app.js',
      'dist/index.html',
    ]);
    // Keyed by the prefix-stripped path, which is what asset publication looks up.
    expect(result.assets?.overrides).toEqual({
      'index.html': { path: '' },
      'about/index.html': { path: 'about' },
    });
  });

  it('should keep index files at their literal path when a route owns them without an entrypoint', async () => {
    const routedFramework: FrameworkDefinition = {
      ...mockFramework,
      getDefaultConfig: () => ({
        ...mockFramework.getDefaultConfig('npm'),
        entrypoint: undefined,
        assetsDir: 'dist',
        routes: [],
        normalizedConfig: {
          entrypoints: [],
          routes: [{ path: '/*', destination: 'edge', handler: 'SERVERLESS_FUNCTION', methods: ['ANY'], headers: {} }],
        },
      }),
    };

    const result = await generate(routedFramework, 'npm', { '/project/dist/about/index.html': '<html></html>' });

    expect(result.assets?.paths).toEqual(['dist/about/index.html']);
    expect(result.assets?.overrides).toBeUndefined();
  });

  it('should not overwrite an asset override the framework already declared', async () => {
    const framework: FrameworkDefinition = {
      ...mockFramework,
      getDefaultConfig: () => ({
        ...mockFramework.getDefaultConfig('npm'),
        entrypoint: undefined,
        assetsDir: 'dist',
        routes: [],
        assetOverrides: { 'about/index.html': { path: 'legacy-about' } },
      }),
    };

    const result = await generate(framework, 'npm', {
      '/project/dist/about/index.html': '<html></html>',
      '/project/dist/index.html': '<html></html>',
    });

    expect(result.assets?.overrides).toEqual({
      'about/index.html': { path: 'legacy-about' },
      'index.html': { path: '' },
    });
  });

  it('should keep index files at their literal path when a server entrypoint owns routing', async () => {
    const result = await generate(mockFramework, 'npm', {
      '/project/public/index.html': '<html></html>',
      '/project/public/about/index.html': '<html></html>',
    });

    expect(result.entrypoints).toHaveLength(1);
    expect(result.assets?.overrides).toBeUndefined();
  });

  it('should preserve manifest-backed asset collections', async () => {
    const framework: FrameworkDefinition = {
      ...mockFramework,
      getDefaultConfig: () => ({
        ...mockFramework.getDefaultConfig('npm'),
        assetsDir: undefined,
        assetManifests: [{ source: '.gigadrive/assets/build.json' }],
      }),
    };

    const result = await generate(framework, 'npm');
    expect(result.assets).toEqual({
      paths: [],
      prefixToStrip: '',
      manifests: [{ source: '.gigadrive/assets/build.json' }],
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

    const result = await generate(noAssetsFramework, 'npm');
    expect(result.assets).toBeUndefined();
  });

  it('should generate routes with SERVERLESS_FUNCTION_STREAMING handler when streaming is true', async () => {
    const result = await generate(mockFramework, 'npm');
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

    const result = await generate(nonStreamingFramework, 'npm');
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0].handler).toBe('SERVERLESS_FUNCTION');
  });

  it('should include environment variables', async () => {
    const result = await generate(mockFramework, 'npm');
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

    const result = await generate(frameworkWithExcludes, 'npm');
    expect(result.excludeFiles).toEqual(['tests/', 'storage/', '.ddev', 'node_modules/']);
  });

  it('should copy framework package defaults onto generated entrypoints', async () => {
    const frameworkWithPackageDefaults: FrameworkDefinition = {
      ...mockFramework,
      getDefaultConfig: () => ({
        ...mockFramework.getDefaultConfig('npm'),
        package: {
          includeFiles: ['dist/**', 'package.json', 'node_modules/**'],
          excludeFiles: ['**/*.map'],
        },
      }),
    };

    const result = await generate(frameworkWithPackageDefaults, 'npm');

    expect(result.entrypoints[0].package).toEqual({
      includeFiles: ['dist/**', 'package.json', 'node_modules/**'],
      excludeFiles: ['**/*.map'],
    });
  });

  it('should not set excludeFiles when not provided', async () => {
    const result = await generate(mockFramework, 'npm');
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

    const result = await generate(customInstallFramework, 'composer');
    expect(result.commands[0]).toBe('composer install --prefer-dist --optimize-autoloader --no-dev');
    expect(result.commands).not.toContain('composer install');
  });

  it('should not produce duplicate install commands for Symfony', async () => {
    const { symfony } = await import('./frameworks/symfony');
    const result = await generate(symfony, 'composer');

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

    const result = await generate(staticFramework, 'npm');
    expect(result.entrypoints).toEqual([]);
    expect(result.routes).toEqual([]);
    expect(result.assets).toBeDefined();
  });
});

import { describe, expect, it } from 'vitest';
import { AVAILABLE_REGIONS } from '../../regions';
import {
  detectProject,
  expectNodePackageManagerPriority,
  expectNodePackageManagerVariants,
  packageJson,
} from './test-utils';

const dependencies = { next: '^16.0.0', react: '^19.0.0' };

const buildManifest = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    version: 1,
    output: 'standalone',
    distDir: '.next',
    repoRootToProject: '.',
    nextVersion: '16.2.10',
    buildId: 'build-id',
    ...overrides,
  });

const imagePolicy = {
  localPatterns: [{ pathname: '/images/**' }],
  remotePatterns: [{ protocol: 'https', hostname: 'images.example.com', pathname: '/**' }],
  widths: [640, 1080],
  heights: [],
  qualities: [75],
  formats: ['image/webp'],
  minimumCacheTTL: 60,
  dangerouslyAllowSVG: false,
  contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  contentDispositionType: 'attachment',
  maximumRedirects: 3,
  maximumResponseBody: 52428800,
  variants: {},
};

const standaloneV2Manifest = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    version: 2,
    mode: 'standalone-v2',
    distDir: '.next',
    repoRootToProject: '.',
    nextVersion: '16.2.10',
    buildId: 'build-id',
    server: { maxDuration: 45, env: { FEATURE_FLAG: 'on' } },
    config: {
      basePath: '',
      trailingSlash: false,
      cacheComponents: true,
      images: imagePolicy,
    },
    routing: {
      beforeMiddleware: [],
      beforeFiles: [],
      afterFiles: [],
      dynamicRoutes: [{ sourceRegex: '^/blog/([^/]+)$' }],
      onMatch: [],
      fallback: [],
      shouldNormalizeNextData: true,
      rsc: {},
    },
    outputs: {
      prerenders: [
        {
          id: 'isr',
          type: 'PRERENDER',
          pathname: '/isr',
          parentOutputId: 'app',
          groupId: 1,
          fallback: { filePath: '.next/server/app/isr.html', initialRevalidate: 5 },
          config: { renderingMode: 'PARTIALLY_STATIC' },
        },
      ],
      staticAssets: [{ sourceDir: '.next/static', urlPrefix: '_next/static', immutable: true }],
    },
    ...overrides,
  });

describe('Next.js framework detection', () => {
  expectNodePackageManagerVariants('Next.js', dependencies, 'next build');
  expectNodePackageManagerPriority(dependencies);

  it('should detect Next.js and generate standalone server config', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
    });

    expect(result.framework).toMatchObject({ slug: 'nextjs', name: 'Next.js' });
    expect(result.config.commands).toEqual(['npm install', 'next build']);
    expect(result.config.entrypoints).toEqual([
      expect.objectContaining({
        path: '.next/standalone/server.js',
        runtime: 'node-22',
        memory: 256,
        maxDuration: 30,
        streaming: true,
      }),
    ]);
    expect(result.config.routes).toEqual([
      expect.objectContaining({ path: '/*', destination: '.next/standalone/server.js' }),
    ]);
    expect(result.config.assets).toMatchObject({
      prefixToStrip: '.next/static/',
      dynamicRoutes: true,
      populateCache: true,
    });
    expect(result.config.environmentVariables).toEqual({ NODE_ENV: 'production' });
  });

  it('should prefer Next.js over lower-priority Vite', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson({ ...dependencies, vite: '^7.0.0' }),
    });

    expect(result.framework.slug).toBe('nextjs');
  });

  it('should package standalone runtime files and publish public and Next static assets', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/.gigadrive/nextjs.json': buildManifest(),
      '/project/.next/standalone/server.js': 'server',
      '/project/.next/standalone/node_modules/next/package.json': '{}',
      '/project/.next/static/chunks/app.js': 'chunk',
      '/project/.next/static/css/app.css': 'css',
      '/project/public/favicon.ico': 'icon',
      '/project/public/images/logo.svg': 'logo',
    });

    expect(result.config.entrypoints).toEqual([
      expect.objectContaining({
        path: 'server.js',
        package: {
          trace: false,
          rootOverwrite: '/project/.next/standalone',
          filePathMap: {
            '/project/.next/static/chunks/app.js': '.next/static/chunks/app.js',
            '/project/.next/static/css/app.css': '.next/static/css/app.css',
            '/project/public/favicon.ico': 'public/favicon.ico',
            '/project/public/images/logo.svg': 'public/images/logo.svg',
          },
        },
      }),
    ]);
    expect(result.config.routes).toEqual([expect.objectContaining({ path: '/*', destination: 'server.js' })]);
    expect(result.config.assets).toEqual({
      paths: ['public/favicon.ico', 'public/images/logo.svg', '.next/static/chunks/app.js', '.next/static/css/app.css'],
      prefixToStrip: '',
      overrides: {
        'public/favicon.ico': { path: 'favicon.ico' },
        'public/images/logo.svg': { path: 'images/logo.svg' },
        '.next/static/chunks/app.js': { path: '_next/static/chunks/app.js' },
        '.next/static/css/app.css': { path: '_next/static/css/app.css' },
      },
      prefixes: undefined,
      dynamicRoutes: true,
      populateCache: true,
    });
  });

  it('should resolve the standalone server emitted for a monorepo application', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/.gigadrive/nextjs.json': buildManifest({ repoRootToProject: 'apps/web' }),
      '/project/.next/standalone/apps/web/server.js': 'server',
      '/project/.next/static/chunks/app.js': 'chunk',
      '/project/public/logo.svg': 'logo',
    });

    expect(result.config.entrypoints[0]).toMatchObject({
      path: 'apps/web/server.js',
      package: {
        trace: false,
        rootOverwrite: '/project/.next/standalone',
        filePathMap: {
          '/project/.next/static/chunks/app.js': 'apps/web/.next/static/chunks/app.js',
          '/project/public/logo.svg': 'apps/web/public/logo.svg',
        },
      },
    });
    expect(result.config.routes[0]?.destination).toBe('apps/web/server.js');
  });

  it('should create a single Next 16 standalone server with a static prefix, framework routing, and managed images', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/.gigadrive/nextjs.json': standaloneV2Manifest(),
      '/project/.next/standalone/server.js': 'server',
      '/project/.next/standalone/node_modules/next/package.json': '{}',
      '/project/.next/server/app/isr.html': '<html>isr</html>',
      '/project/public/gigadrive-mark.svg': '<svg />',
    });

    expect(result.config.entrypoints).toHaveLength(1);
    expect(result.config.entrypoints[0]).toMatchObject({
      displayName: 'next-server',
      path: 'server.js',
      runtime: 'node-22',
      streaming: true,
      maxDuration: 45,
      environmentVariables: { NEXT_BUILD_ID: 'build-id', FEATURE_FLAG: 'on' },
      package: {
        trace: false,
        rootOverwrite: '/project/.next/standalone',
        filePathMap: { '/project/public/gigadrive-mark.svg': 'public/gigadrive-mark.svg' },
      },
    });
    expect(result.config.regions).toEqual([...AVAILABLE_REGIONS]);
    expect(result.config.routes).toEqual([
      expect.objectContaining({ path: '/*', destination: 'server.js', handler: 'SERVERLESS_FUNCTION_STREAMING' }),
    ]);
    // `.next/static` is registered as one prefix, not enumerated file-by-file.
    expect(result.config.assets).toMatchObject({
      paths: expect.arrayContaining(['public/gigadrive-mark.svg', '.next/server/app/isr.html']),
      prefixes: [{ source: '.next/static', destination: '_next/static', immutable: true, populateCache: true }],
      overrides: {
        'public/gigadrive-mark.svg': { path: 'gigadrive-mark.svg' },
        // The prerender shell is published to an internal asset path for edge seeding.
        '.next/server/app/isr.html': { path: '_gigadrive/prerender/isr.html' },
      },
      populateCache: true,
    });
    expect(result.config.framework).toMatchObject({
      type: 'nextjs',
      schemaVersion: 2,
      mode: 'standalone-v2',
      buildId: 'build-id',
      routing: { shouldNormalizeNextData: true },
      outputs: {
        staticAssets: [{ sourceDir: '.next/static', urlPrefix: '_next/static', immutable: true }],
      },
    });
    expect(result.config.framework?.outputs.prerenders[0]).toMatchObject({
      id: 'isr',
      fallback: { filePath: '/_gigadrive/prerender/isr.html', initialRevalidate: 5 },
    });
    expect(result.config.images).toMatchObject({
      remotePatterns: [{ protocol: 'https', hostname: 'images.example.com', pathname: '/**' }],
      widths: [640, 1080],
    });
    expect(result.config.sharedArtifacts).toEqual([]);
  });

  it('should ignore malformed, unsafe, or legacy adapter-v2 metadata', async () => {
    const malformed = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/.gigadrive/nextjs.json': '{invalid',
    });
    const unsafe = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/.gigadrive/nextjs.json': buildManifest({ distDir: '../outside' }),
      '/outside/standalone/server.js': 'server',
    });
    const legacyAdapterV2 = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/.gigadrive/nextjs.json': standaloneV2Manifest({ mode: 'adapter-v2' }),
    });

    expect(malformed.config.entrypoints[0]?.path).toBe('.next/standalone/server.js');
    expect(unsafe.config.entrypoints[0]?.path).toBe('.next/standalone/server.js');
    expect(legacyAdapterV2.config.entrypoints[0]?.path).toBe('.next/standalone/server.js');
  });

  it('should publish static export routes without a runtime entrypoint', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/.gigadrive/nextjs.json': buildManifest({ output: 'export' }),
      '/project/out/index.html': 'home',
      '/project/out/about/index.html': 'about',
      '/project/out/_next/static/app.js': 'chunk',
    });

    expect(result.config.entrypoints).toEqual([]);
    expect(result.config.routes).toEqual([]);
    expect(result.config.assets).toEqual(
      expect.objectContaining({
        paths: ['out/index.html', 'out/about/index.html', 'out/_next/static/app.js'],
        prefixToStrip: '',
        overrides: {
          'out/index.html': { path: '' },
          'out/about/index.html': { path: 'about' },
          'out/_next/static/app.js': { path: '_next/static/app.js' },
        },
      })
    );
  });
});

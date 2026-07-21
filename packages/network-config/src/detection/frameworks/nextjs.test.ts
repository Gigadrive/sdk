import { describe, expect, it } from 'vitest';
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

const adapterManifest = () =>
  JSON.stringify({
    version: 2,
    mode: 'adapter-v2',
    distDir: '.next',
    repoRootToProject: '.',
    nextVersion: '16.2.10',
    buildId: 'build-id',
    config: {
      basePath: '',
      trailingSlash: false,
      cacheComponents: true,
      images: {
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
      },
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
      pages: [
        {
          id: 'page',
          type: 'PAGES',
          filePath: '.next/server/page.js',
          pathname: '/',
          sourcePage: 'pages/index.tsx',
          runtime: 'nodejs',
          assets: {
            '.next/server/page.js': '.next/server/page.js',
            '.next/server/shared.js': '.next/server/shared.js',
          },
          config: { maxDuration: 20 },
        },
      ],
      appPages: [
        {
          id: 'app',
          type: 'APP_PAGE',
          filePath: '.next/server/app.js',
          pathname: '/app',
          sourcePage: 'app/page.tsx',
          runtime: 'nodejs',
          assets: {
            '.next/server/app.js': '.next/server/app.js',
            '.next/server/shared.js': '.next/server/shared.js',
          },
          config: { maxDuration: 40 },
        },
      ],
      pagesApi: [],
      appRoutes: [],
      prerenders: [],
      staticFiles: [
        {
          id: 'static',
          type: 'STATIC_FILE',
          filePath: '.next/static/app.js',
          pathname: '/_next/static/app.js',
        },
      ],
    },
    entrypoints: [
      {
        id: 'next-0',
        runtime: 'nodejs',
        filePath: '.gigadrive/nextjs/entrypoints/next-0.mjs',
        outputIds: ['page'],
        assets: {
          '.gigadrive/nextjs/entrypoints/next-0.mjs': '.gigadrive/nextjs/entrypoints/next-0.mjs',
          '.next/server/shared.js': '.next/server/shared.js',
        },
        config: { maxDuration: 20 },
      },
      {
        id: 'next-1',
        runtime: 'nodejs',
        filePath: '.gigadrive/nextjs/entrypoints/next-1.mjs',
        outputIds: ['app'],
        assets: {
          '.gigadrive/nextjs/entrypoints/next-1.mjs': '.gigadrive/nextjs/entrypoints/next-1.mjs',
          '.next/server/shared.js': '.next/server/shared.js',
        },
        config: { maxDuration: 40 },
      },
    ],
    outputEntrypoints: { page: 'next-0', app: 'next-1' },
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

  it('should create split Next 16 functions, shared artifacts, framework routing, and managed images', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/.gigadrive/nextjs.json': adapterManifest(),
      '/project/.gigadrive/nextjs/entrypoints/next-0.mjs': 'export default async function handler() {}',
      '/project/.gigadrive/nextjs/entrypoints/next-1.mjs': 'export default async function handler() {}',
      '/project/.next/server/page.js': 'export const handler = () => {}',
      '/project/.next/server/app.js': 'export const handler = () => {}',
      '/project/.next/server/shared.js': 'export const shared = true',
      '/project/.next/static/app.js': 'static',
      '/project/public/gigadrive-mark.svg': '<svg />',
    });

    expect(result.config.entrypoints).toHaveLength(2);
    expect(result.config.assets).toMatchObject({
      paths: expect.arrayContaining(['public/gigadrive-mark.svg', '.next/static/app.js']),
      overrides: expect.objectContaining({
        'public/gigadrive-mark.svg': { path: 'gigadrive-mark.svg' },
      }),
    });
    expect(result.config.entrypoints).toEqual([
      expect.objectContaining({
        path: '.gigadrive/nextjs/entrypoints/next-0.mjs',
        maxDuration: 20,
        environmentVariables: expect.objectContaining({ GIGADRIVE_NEXT_ENTRYPOINT_ID: 'next-0' }),
        package: expect.objectContaining({
          includeProjectFiles: false,
          filePathMap: expect.objectContaining({
            '/project/.next/server/page.js': '.next/server/page.js',
          }),
          preserveSymlinks: true,
          sharedArtifactIds: ['next-shared'],
        }),
      }),
      expect.objectContaining({
        path: '.gigadrive/nextjs/entrypoints/next-1.mjs',
        maxDuration: 40,
        package: expect.objectContaining({
          includeProjectFiles: false,
          filePathMap: expect.objectContaining({
            '/project/.next/server/app.js': '.next/server/app.js',
          }),
          preserveSymlinks: true,
          sharedArtifactIds: ['next-shared'],
        }),
      }),
    ]);
    expect(result.config.routes).toEqual([]);
    expect(result.config.sharedArtifacts).toEqual([
      {
        id: 'next-shared',
        filePathMap: { '/project/.next/server/shared.js': '.next/server/shared.js' },
      },
    ]);
    expect(result.config.framework).toMatchObject({
      type: 'nextjs',
      schemaVersion: 2,
      buildId: 'build-id',
      routing: { shouldNormalizeNextData: true },
    });
    expect(result.config.images).toMatchObject({
      remotePatterns: [{ protocol: 'https', hostname: 'images.example.com', pathname: '/**' }],
      widths: [640, 1080],
    });
    expect(result.config.assets).toMatchObject({
      paths: ['public/gigadrive-mark.svg', '.next/static/app.js'],
      overrides: {
        'public/gigadrive-mark.svg': { path: 'gigadrive-mark.svg' },
        '.next/static/app.js': { path: '_next/static/app.js' },
      },
    });
  });

  it('should ignore malformed or unsafe adapter metadata', async () => {
    const malformed = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/.gigadrive/nextjs.json': '{invalid',
    });
    const unsafe = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/.gigadrive/nextjs.json': buildManifest({ distDir: '../outside' }),
      '/outside/standalone/server.js': 'server',
    });

    expect(malformed.config.entrypoints[0]?.path).toBe('.next/standalone/server.js');
    expect(unsafe.config.entrypoints[0]?.path).toBe('.next/standalone/server.js');
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

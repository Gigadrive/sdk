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
          rootOverwrite: '/project/.next/standalone',
          includeFiles: ['.next/standalone/**'],
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
        rootOverwrite: '/project/.next/standalone',
        filePathMap: {
          '/project/.next/static/chunks/app.js': 'apps/web/.next/static/chunks/app.js',
          '/project/public/logo.svg': 'apps/web/public/logo.svg',
        },
      },
    });
    expect(result.config.routes[0]?.destination).toBe('apps/web/server.js');
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

import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import type { NormalizedConfig } from '../../normalized-config';
import { AVAILABLE_REGIONS } from '../../regions';
import { mergeWithFrameworkDefaults } from '../merge-config';
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
      prerenders: [],
      prerenderManifest: '.gigadrive/nextjs-prerenders.json',
      assetManifest: '.gigadrive/assets/nextjs.json',
      entryPagePaths: ['/isr'],
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
    // Without a Gigadrive build manifest the fallback declares no asset
    // directory: `.next/static` answers `/_next/static/...`, which only the
    // manifest-driven configs map. Publishing it under its own stripped prefix
    // would serve every chunk from the wrong URL.
    expect(result.config.assets).toBeUndefined();
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
      // One server renders the whole app, so it is sized well above the
      // per-route function default it replaced.
      memory: 1024,
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
      paths: ['public/gigadrive-mark.svg'],
      prefixes: [{ source: '.next/static', destination: '_next/static', immutable: true, populateCache: true }],
      manifests: [{ source: '.gigadrive/assets/nextjs.json' }],
      overrides: { 'public/gigadrive-mark.svg': { path: 'gigadrive-mark.svg' } },
      populateCache: true,
    });
    // Manifest-backed assets are not expanded into per-file config entries.
    expect(result.config.assets?.paths).not.toContain('.next/server/app/isr.html');
    expect(Object.keys(result.config.assets?.overrides ?? {})).not.toContain('.next/server/app/isr.html');
    expect(result.config.framework).toMatchObject({
      type: 'nextjs',
      schemaVersion: 2,
      mode: 'standalone-v2',
      buildId: 'build-id',
      routing: { shouldNormalizeNextData: true },
      outputs: {
        prerenderManifest: '.gigadrive/nextjs-prerenders.json',
        assetManifest: '.gigadrive/assets/nextjs.json',
        staticAssets: [{ sourceDir: '.next/static', urlPrefix: '_next/static', immutable: true }],
      },
    });
    // The full prerender table remains in its sidecar; only a bounded warming sample is inline.
    expect(result.config.framework?.outputs.prerenders).toEqual([]);
    expect(result.config.framework?.outputs).not.toHaveProperty('entryPagePaths');
    expect(result.config.framework?.entryPagePaths).toEqual(['/isr']);
    expect(result.config.images).toMatchObject({
      remotePatterns: [{ protocol: 'https', hostname: 'images.example.com', pathname: '/**' }],
      widths: [640, 1080],
    });
    expect(result.config.sharedArtifacts).toEqual([]);
  });

  it('should bound adapter-provided entry paths without duplicating them in outputs', async () => {
    const suppliedPaths = Array.from({ length: 75 }, (_, index) => `/docs/${index}`);
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/.gigadrive/nextjs.json': standaloneV2Manifest({
        outputs: {
          prerenders: [],
          prerenderManifest: '.gigadrive/nextjs-prerenders.json',
          assetManifest: '.gigadrive/assets/nextjs.json',
          entryPagePaths: suppliedPaths,
          staticAssets: [],
        },
      }),
      '/project/.next/standalone/server.js': 'server',
      '/project/.next/standalone/node_modules/next/package.json': '{}',
    });

    expect(result.config.framework?.entryPagePaths).toEqual(suppliedPaths.slice(0, 50));
    expect(result.config.framework?.outputs).not.toHaveProperty('entryPagePaths');
  });

  it('should serve a standalone build from Next 15.3 or older, which writes no adapter manifest', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/.next/standalone/server.js': 'server',
      '/project/.next/standalone/.next/BUILD_ID': 'build',
      '/project/.next/standalone/node_modules/next/package.json': '{}',
      '/project/.next/static/chunks/app.js': 'chunk',
      '/project/public/favicon.ico': 'icon',
    });

    expect(result.config.entrypoints).toEqual([
      expect.objectContaining({
        path: 'server.js',
        package: {
          trace: false,
          rootOverwrite: '/project/.next/standalone',
          filePathMap: {
            '/project/.next/static/chunks/app.js': '.next/static/chunks/app.js',
            '/project/public/favicon.ico': 'public/favicon.ico',
          },
        },
      }),
    ]);
    expect(result.config.assets?.overrides).toEqual({
      'public/favicon.ico': { path: 'favicon.ico' },
      '.next/static/chunks/app.js': { path: '_next/static/chunks/app.js' },
    });
    expect(result.config.framework).toBeUndefined();
  });

  it('should find the application of an older monorepo standalone build without entering node_modules', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/.next/standalone/node_modules/some-lib/server.js': 'not the app',
      '/project/.next/standalone/node_modules/some-lib/.next/BUILD_ID': 'not the app',
      '/project/.next/standalone/apps/web/server.js': 'server',
      '/project/.next/standalone/apps/web/.next/BUILD_ID': 'build',
      '/project/.next/static/chunks/app.js': 'chunk',
    });

    expect(result.config.entrypoints[0]?.path).toBe('apps/web/server.js');
    expect(result.config.assets?.overrides).toEqual({
      '.next/static/chunks/app.js': { path: '_next/static/chunks/app.js' },
    });
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

  it('should publish a static export from the custom distDir Next wrote it to', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/.gigadrive/nextjs.json': buildManifest({ output: 'export', outDir: 'build' }),
      '/project/build/index.html': 'home',
      '/project/build/about.html': 'about',
      '/project/build/_next/static/app.js': 'chunk',
      '/project/out/stale.html': 'an older export',
    });

    expect(result.config.entrypoints).toEqual([]);
    expect(result.config.assets).toEqual(
      expect.objectContaining({
        paths: ['build/index.html', 'build/about.html', 'build/_next/static/app.js'],
        overrides: {
          'build/index.html': { path: '' },
          'build/about.html': { path: 'about' },
          'build/_next/static/app.js': { path: '_next/static/app.js' },
        },
      })
    );
  });

  it('should publish the pages of a static export without trailing slashes at the URLs Next links to', async () => {
    // `trailingSlash: false`, Next's default, writes `about.html`, not `about/index.html`.
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/.gigadrive/nextjs.json': buildManifest({ output: 'export' }),
      '/project/out/index.html': 'home',
      '/project/out/about.html': 'about',
      '/project/out/blog/first-post.html': 'post',
      '/project/out/404.html': 'not found',
      '/project/out/about.txt': 'rsc payload',
      '/project/public/legacy/report.html': 'report',
      '/project/out/legacy/report.html': 'report',
      '/project/out/_next/static/app.js': 'chunk',
    });

    expect(result.config.assets?.overrides).toEqual({
      'out/index.html': { path: '' },
      'out/about.html': { path: 'about' },
      'out/blog/first-post.html': { path: 'blog/first-post' },
      'out/404.html': { path: '404' },
      // The client router fetches RSC payloads by their own file name.
      'out/about.txt': { path: 'about.txt' },
      // A file copied from `public/` keeps the name it is requested by.
      'out/legacy/report.html': { path: 'legacy/report.html' },
      'out/_next/static/app.js': { path: '_next/static/app.js' },
    });
  });
});

describe('Next.js with a config file', () => {
  const nextProject = () =>
    detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/.gigadrive/nextjs.json': standaloneV2Manifest(),
      '/project/.next/standalone/server.js': 'server',
      '/project/.next/standalone/node_modules/next/package.json': '{}',
      '/project/public/gigadrive-mark.svg': '<svg />',
    });

  const userConfig = (overrides: Partial<NormalizedConfig> = {}): NormalizedConfig => ({
    regions: ['fr-par'],
    commands: [],
    entrypoints: [],
    routes: [],
    assets: { paths: [], prefixToStrip: '/', dynamicRoutes: true, populateCache: false },
    environmentVariables: { API_URL: 'https://api.example.com' },
    warnings: [],
    errors: [],
    ...overrides,
  });

  const redirect = {
    path: '/old',
    destination: 'https://example.com/new',
    handler: 'HTTP_REDIRECT' as const,
    methods: ['ANY' as const],
    headers: {},
  };

  it('keeps the Next.js integration when the config file declares no functions', async () => {
    const detected = await nextProject();
    const merged = await Effect.runPromise(
      mergeWithFrameworkDefaults(userConfig({ routes: [redirect] }), detected.config)
    );

    expect(merged.framework).toEqual(detected.config.framework);
    expect(merged.framework?.type).toBe('nextjs');
    expect(merged.images).toEqual(detected.config.images);
    expect(merged.sharedArtifacts).toEqual(detected.config.sharedArtifacts);
    // The CLI must still upload the project, config file included.
    expect(merged.userArchive).toBeUndefined();
    expect(merged.entrypoints).toEqual(detected.config.entrypoints);
    // The config file's routes run first; the server's catch-all stays last.
    expect(merged.routes).toEqual([redirect, ...detected.config.routes]);
    expect(merged.assets).toEqual(detected.config.assets);
    expect(merged.environmentVariables).toMatchObject({ API_URL: 'https://api.example.com' });
    expect(merged.regions).toEqual(['fr-par']);
    expect(merged.warnings.join('\n')).not.toContain('integration is off');
  });

  it('keeps the Next.js assets and warns when the config file declares assets', async () => {
    const detected = await nextProject();
    const merged = await Effect.runPromise(
      mergeWithFrameworkDefaults(
        userConfig({ assets: { paths: ['static/a.txt'], prefixToStrip: 'static/' } }),
        detected.config
      )
    );

    expect(merged.framework?.type).toBe('nextjs');
    expect(merged.assets).toEqual(detected.config.assets);
    expect(merged.warnings).toContain(
      '`assets` in your config file is ignored: Next.js publishes `.next/static` and `public` itself.'
    );
  });

  it('prefers an image policy from the config file', async () => {
    const detected = await nextProject();
    const detectedImages = detected.config.images;
    if (!detectedImages) throw new Error('the Next.js build declares an image policy');
    const images = { ...detectedImages, qualities: [50] };
    const merged = await Effect.runPromise(mergeWithFrameworkDefaults(userConfig({ images }), detected.config));

    expect(merged.images).toEqual(images);
    expect(merged.framework?.type).toBe('nextjs');
  });

  it('turns the integration off with a warning when the config file declares functions', async () => {
    const detected = await nextProject();
    const own = { path: 'api/index.js', runtime: 'node-22' as const, memory: 256, maxDuration: 30 };
    const merged = await Effect.runPromise(
      mergeWithFrameworkDefaults(userConfig({ entrypoints: [own] }), detected.config)
    );

    expect(merged.framework).toBeUndefined();
    expect(merged.sharedArtifacts).toBeUndefined();
    expect(merged.userArchive).toBeUndefined();
    expect(merged.entrypoints).toEqual([own]);
    expect(merged.warnings).toContain(
      'The Next.js integration is off because your config file declares its own functions. Remove them to keep Next.js routing, prerendering and image optimization.'
    );
  });
});

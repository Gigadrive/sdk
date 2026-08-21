import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseStaticAssetManifest } from './asset-manifest';
import gigadriveNextAdapter from './nextjs-adapter';
import {
  parseGigadriveNextBuildManifest,
  parseGigadriveNextPrerenderManifest,
  type GigadriveNextBuildManifestV2Standalone,
} from './nextjs-manifest';

const temporaryDirectories: string[] = [];

const nextConfig = (overrides: Record<string, unknown> = {}) => ({
  basePath: '',
  trailingSlash: false,
  cacheComponents: false,
  output: undefined,
  deploymentId: undefined,
  cacheHandler: undefined,
  cacheHandlers: undefined,
  images: {
    deviceSizes: [640, 1080],
    imageSizes: [32, 64],
    loader: 'default',
    path: '/_next/image',
    loaderFile: '',
    domains: [],
    disableStaticImages: false,
    minimumCacheTTL: 60,
    formats: ['image/webp'],
    maximumDiskCacheSize: undefined,
    maximumRedirects: 3,
    maximumResponseBody: 50 * 1024 * 1024,
    dangerouslyAllowLocalIP: false,
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    contentDispositionType: 'attachment',
    remotePatterns: [],
    localPatterns: [{ pathname: '/images/**' }],
    qualities: [75],
    unoptimized: false,
    customCacheHandler: false,
  },
  ...overrides,
});

const emptyRouting = {
  beforeMiddleware: [],
  beforeFiles: [],
  afterFiles: [],
  dynamicRoutes: [],
  onMatch: [],
  fallback: [],
  shouldNormalizeNextData: false,
  rsc: {},
};

const emptyOutputs = {
  pages: [],
  pagesApi: [],
  appPages: [],
  appRoutes: [],
  prerenders: [],
  staticFiles: [],
};

const modifyConfig = (config: Record<string, unknown>, phase: string, nextVersion?: string) => {
  if (!gigadriveNextAdapter.modifyConfig) throw new Error('Expected modifyConfig');
  return (
    gigadriveNextAdapter.modifyConfig as unknown as (
      config: Record<string, unknown>,
      context: { phase: string; nextVersion?: string }
    ) => Record<string, unknown>
  )(config, { phase, nextVersion });
};

const onBuildComplete = async (context: Record<string, unknown>): Promise<void> => {
  if (!gigadriveNextAdapter.onBuildComplete) throw new Error('Expected onBuildComplete');
  await (gigadriveNextAdapter.onBuildComplete as unknown as (context: Record<string, unknown>) => Promise<void>)(
    context
  );
};

const readManifest = async (projectDir: string) =>
  parseGigadriveNextBuildManifest(await readFile(path.join(projectDir, '.gigadrive', 'nextjs.json'), 'utf8'));

const readAssetManifest = async (projectDir: string) =>
  parseStaticAssetManifest(await readFile(path.join(projectDir, '.gigadrive', 'assets', 'nextjs.json'), 'utf8'));

const readPrerenderManifest = async (projectDir: string) =>
  parseGigadriveNextPrerenderManifest(
    await readFile(path.join(projectDir, '.gigadrive', 'nextjs-prerenders.json'), 'utf8')
  );

afterEach(async () => {
  delete process.env.GIGADRIVE_DEPLOYMENT_ID;
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('Gigadrive Next.js adapter', () => {
  it('runs the managed build as one standalone server with the platform cache and image loader', () => {
    const config = nextConfig({ reactStrictMode: true });
    process.env.GIGADRIVE_DEPLOYMENT_ID = 'deployment-id';

    const result = modifyConfig(config, 'phase-production-build', '16.2.10');

    expect(result).toMatchObject({
      reactStrictMode: true,
      deploymentId: 'deployment-id',
      output: 'standalone',
      cacheMaxMemorySize: 0,
      cacheHandlers: {
        default: expect.stringContaining('nextjs-cache-components-handler.js'),
        remote: expect.stringContaining('nextjs-cache-components-handler.js'),
      },
      images: {
        loader: 'custom',
        loaderFile: expect.stringContaining('nextjs-image-loader.js'),
      },
    });
    expect(result.cacheHandler).toEqual(expect.stringContaining('nextjs-cache-handler.js'));
    // The caller's config object is never mutated in place.
    expect(config.output).toBeUndefined();
  });

  it('preserves development and static export builds without standalone or injection', () => {
    const developmentConfig = nextConfig({ reactStrictMode: true });
    const exportConfig = nextConfig({ output: 'export', trailingSlash: true });

    expect(modifyConfig(developmentConfig, 'phase-development-server', '16.2.10')).toBe(developmentConfig);
    expect(modifyConfig(exportConfig, 'phase-production-build', '16.2.10')).toEqual(exportConfig);
  });

  it('keeps explicit user cache and image integrations while still forcing standalone output', () => {
    const customConfig = nextConfig({
      cacheHandler: '/user/cache.js',
      cacheHandlers: { remote: '/user/components.js' },
      cacheMaxMemorySize: 1024,
      images: { ...nextConfig().images, loader: 'custom', loaderFile: '/user/image.js' },
    });

    expect(modifyConfig(customConfig, 'phase-production-build', '16.2.10')).toMatchObject({
      output: 'standalone',
      cacheHandler: '/user/cache.js',
      cacheHandlers: { remote: '/user/components.js' },
      cacheMaxMemorySize: 1024,
      images: { loader: 'custom', loaderFile: '/user/image.js' },
    });
  });

  it('retains standalone output for Next 14 and 15 without managed injections', () => {
    const result = modifyConfig(nextConfig(), 'phase-production-build', '15.5.20');
    expect(result).toMatchObject({ output: 'standalone' });
    expect(result.cacheHandler).toBeUndefined();
    expect(result.cacheHandlers).toBeUndefined();
    expect(modifyConfig(nextConfig({ output: 'export' }), 'phase-production-build', '14.2.0')).toMatchObject({
      output: 'export',
    });
  });

  it('uses the standalone fallback when Next does not expose a modifyConfig version', () => {
    process.env.GIGADRIVE_DEPLOYMENT_ID = 'deployment-id';

    expect(modifyConfig(nextConfig(), 'phase-production-build')).toMatchObject({
      deploymentId: 'deployment-id',
      output: 'standalone',
    });
  });

  it('writes a portable legacy manifest for the Next 16.1 adapter contract', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'network-next-16-1-adapter-'));
    temporaryDirectories.push(repoRoot);
    const projectDir = path.join(repoRoot, 'apps', 'web');
    const distDir = path.join(projectDir, '.next');
    await mkdir(projectDir, { recursive: true });

    await onBuildComplete({
      projectDir,
      repoRoot,
      distDir,
      config: nextConfig({ output: 'standalone' }),
      nextVersion: '16.1.6',
      buildId: 'next-16-1-build',
    });

    expect(await readManifest(projectDir)).toEqual({
      version: 1,
      output: 'standalone',
      distDir: '.next',
      repoRootToProject: 'apps/web',
      nextVersion: '16.1.6',
      buildId: 'next-16-1-build',
    });
  });

  it('writes a single-server standalone-v2 manifest with a static prefix and prerender metadata', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'network-next-standalone-v2-'));
    temporaryDirectories.push(repoRoot);
    const projectDir = path.join(repoRoot, 'apps', 'web');
    const distDir = path.join(projectDir, '.next');
    const fallbackPath = path.join(distDir, 'server', 'app', 'isr.html');
    const isrFallbackPath = path.join(distDir, 'server', 'app', 'isr-plain.html');
    const dynamicFallbackPath = path.join(distDir, 'server', 'pages', 'blog', '[slug].html');
    const dynamicRscPath = path.join(distDir, 'server', 'app', 'blog', '[slug].rsc');
    const rscFallbackPath = path.join(distDir, 'server', 'rsc-fallback.json');
    const faviconPath = path.join(distDir, 'server', 'app', 'favicon.ico.body');
    const faviconMetaPath = path.join(distDir, 'server', 'app', 'favicon.ico.meta');
    const robotsPath = path.join(distDir, 'server', 'app', 'robots.txt.body');
    const robotsMetaPath = path.join(distDir, 'server', 'app', 'robots.txt.meta');
    const staticPagePath = path.join(distDir, 'server', 'pages', 'index.html');
    const staticChunkPath = path.join(distDir, 'static', 'chunks', 'app.js');
    await mkdir(path.dirname(fallbackPath), { recursive: true });
    await mkdir(path.dirname(dynamicFallbackPath), { recursive: true });
    await mkdir(path.dirname(dynamicRscPath), { recursive: true });
    await mkdir(path.dirname(faviconPath), { recursive: true });
    await mkdir(path.dirname(staticPagePath), { recursive: true });
    await mkdir(path.dirname(staticChunkPath), { recursive: true });
    await writeFile(fallbackPath, '<html>isr</html>');
    await writeFile(isrFallbackPath, '<html>isr plain</html>');
    await writeFile(dynamicFallbackPath, '<html>fallback</html>');
    await writeFile(dynamicRscPath, 'fallback-rsc');
    await writeFile(rscFallbackPath, '{}');
    await writeFile(faviconPath, 'icon');
    await writeFile(
      faviconMetaPath,
      JSON.stringify({
        status: 404,
        headers: {
          'content-type': 'image/x-icon',
          'cache-control': 'public, max-age=0',
          'x-next-cache-tags': 'категория',
          'X-Nextjs-Prerender': '1',
        },
      })
    );
    await writeFile(robotsPath, 'User-agent: *');
    await writeFile(robotsMetaPath, JSON.stringify({ headers: { 'x-next-cache-tags': 'категория' } }));
    await writeFile(staticPagePath, '<html>home</html>');
    await writeFile(staticChunkPath, 'chunk');

    const routeOutput = (id: string, config: Record<string, unknown>) => ({
      id,
      type: 'APP_PAGE',
      filePath: `${distDir}/server/app/${id}.js`,
      pathname: `/${id}`,
      sourcePage: `app/${id}/page.tsx`,
      runtime: 'nodejs',
      assets: {},
      config,
    });

    await onBuildComplete({
      projectDir,
      repoRoot,
      distDir,
      config: nextConfig(),
      nextVersion: '16.2.10',
      buildId: 'build-id',
      routing: { ...emptyRouting, shouldNormalizeNextData: true, rsc: { header: 'rsc' } },
      outputs: {
        pages: [{ ...routeOutput('home', { maxDuration: 30 }), type: 'PAGES', pathname: '/' }],
        pagesApi: [],
        appPages: [routeOutput('blog', { maxDuration: 60, env: { FEATURE_FLAG: 'on' } })],
        appRoutes: [],
        prerenders: [
          {
            id: 'isr',
            type: 'PRERENDER',
            pathname: '/isr',
            parentOutputId: 'blog',
            groupId: 1,
            fallback: {
              filePath: fallbackPath,
              initialRevalidate: 5,
              initialExpiration: 31_536_000,
              postponedState: 'postponed',
            },
            config: { renderingMode: 'PARTIALLY_STATIC', allowQuery: ['q'] },
          },
          {
            id: 'blog/[slug]',
            type: 'PRERENDER',
            pathname: '/blog/[slug]',
            parentOutputId: 'blog',
            groupId: 2,
            fallback: { filePath: dynamicFallbackPath, initialRevalidate: 5 },
            config: { allowQuery: ['slug'] },
          },
          {
            id: 'isr-plain',
            type: 'PRERENDER',
            pathname: '/isr-plain',
            parentOutputId: 'blog',
            groupId: 3,
            fallback: { filePath: isrFallbackPath, initialRevalidate: 60 },
            config: {},
          },
        ],
        staticFiles: [
          {
            id: 'index',
            type: 'STATIC_FILE',
            pathname: '/index',
            filePath: staticPagePath,
            immutableHash: undefined,
          },
          {
            id: 'static/chunks/app.js',
            type: 'STATIC_FILE',
            pathname: '/_next/static/chunks/app.js',
            filePath: staticChunkPath,
            immutableHash: 'hash',
          },
          {
            id: 'blog/[slug].rsc',
            type: 'STATIC_FILE',
            pathname: '/blog/[slug].rsc',
            filePath: dynamicRscPath,
            immutableHash: undefined,
          },
          {
            id: 'index.rsc',
            type: 'STATIC_FILE',
            pathname: '/index.rsc',
            filePath: rscFallbackPath,
            immutableHash: undefined,
          },
          {
            id: 'favicon.ico',
            type: 'STATIC_FILE',
            pathname: '/favicon.ico',
            filePath: faviconPath,
            immutableHash: undefined,
          },
          {
            id: 'robots.txt',
            type: 'STATIC_FILE',
            pathname: '/robots.txt',
            filePath: robotsPath,
            immutableHash: undefined,
          },
        ],
      },
    });

    const manifest = (await readManifest(projectDir)) as GigadriveNextBuildManifestV2Standalone;
    expect(manifest).toMatchObject({
      version: 2,
      mode: 'standalone-v2',
      distDir: '.next',
      repoRootToProject: 'apps/web',
      nextVersion: '16.2.10',
      buildId: 'build-id',
      // One server honors one duration limit: the max across every route.
      server: { maxDuration: 60, env: { FEATURE_FLAG: 'on' } },
      config: { basePath: '', trailingSlash: false, cacheComponents: false, images: { qualities: [75] } },
      routing: { shouldNormalizeNextData: true, rsc: { header: 'rsc' } },
      outputs: {
        prerenders: [],
        prerenderManifest: '.gigadrive/nextjs-prerenders.json',
        assetManifest: '.gigadrive/assets/nextjs.json',
        entryPagePaths: ['/isr-plain'],
        staticAssets: [{ sourceDir: '.next/static', urlPrefix: '_next/static', immutable: true }],
      },
    });
    expect(manifest.outputs.prerenders).toEqual([]);

    const prerenderManifest = await readPrerenderManifest(projectDir);
    expect(prerenderManifest?.prerenders).toHaveLength(3);
    expect(prerenderManifest?.prerenders[0]).toMatchObject({
      id: 'isr',
      pathname: '/isr',
      fallback: {
        filePath: 'apps/web/.next/server/app/isr.html',
        initialRevalidate: 5,
        initialExpiration: 31_536_000,
        postponedState: 'postponed',
      },
      config: { renderingMode: 'PARTIALLY_STATIC', allowQuery: ['q'] },
    });
    expect(prerenderManifest?.prerenders[1]).toMatchObject({
      id: 'blog/[slug]',
      pathname: '/blog/[slug]',
      fallback: { filePath: 'apps/web/.next/server/pages/blog/[slug].html' },
    });
    expect(prerenderManifest?.prerenders[2]).toMatchObject({
      id: 'isr-plain',
      pathname: '/isr-plain',
      fallback: { filePath: 'apps/web/.next/server/app/isr-plain.html', initialRevalidate: 60 },
    });

    expect(await readAssetManifest(projectDir)).toEqual({
      version: 1,
      assets: [
        {
          source: '.next/server/pages/index.html',
          path: '/',
          headers: { 'content-type': 'text/html; charset=utf-8' },
        },
        {
          source: '.next/server/rsc-fallback.json',
          path: '/index.rsc',
          headers: { 'content-type': 'text/x-component' },
        },
        {
          source: '.next/server/app/favicon.ico.body',
          path: '/favicon.ico',
          status: 404,
          headers: { 'content-type': 'image/x-icon', 'cache-control': 'public, max-age=0' },
        },
      ],
    });
    // No per-route entrypoints or wrappers exist in the single-server model.
    expect((manifest as unknown as Record<string, unknown>).entrypoints).toBeUndefined();
    expect((manifest as unknown as Record<string, unknown>).outputEntrypoints).toBeUndefined();
    await expect(readFile(path.join(projectDir, '.gigadrive', 'nextjs', 'entrypoints'))).rejects.toThrow();
  });

  it('maps Pages Router root and status pages with a configured base path', async () => {
    const projectDir = await mkdtemp(path.join(os.tmpdir(), 'network-next-base-path-'));
    temporaryDirectories.push(projectDir);
    const distDir = path.join(projectDir, '.next');
    const staticPagePath = path.join(distDir, 'server', 'pages', 'index.html');
    const notFoundPagePath = path.join(distDir, 'server', 'pages', '404.html');
    const localizedNotFoundPagePath = path.join(distDir, 'server', 'pages', 'de', '404.html');
    const errorPagePath = path.join(distDir, 'server', 'pages', '500.html');
    await mkdir(path.dirname(staticPagePath), { recursive: true });
    await mkdir(path.dirname(localizedNotFoundPagePath), { recursive: true });
    await writeFile(staticPagePath, '<html>home</html>');
    await writeFile(notFoundPagePath, '<html>not found</html>');
    await writeFile(localizedNotFoundPagePath, '<html>nicht gefunden</html>');
    await writeFile(errorPagePath, '<html>error</html>');

    await onBuildComplete({
      projectDir,
      repoRoot: projectDir,
      distDir,
      config: nextConfig({ basePath: '/docs', i18n: { locales: ['en', 'de'], defaultLocale: 'en' } }),
      nextVersion: '16.2.10',
      buildId: 'build-id',
      routing: emptyRouting,
      outputs: {
        ...emptyOutputs,
        staticFiles: [
          {
            id: 'index',
            type: 'STATIC_FILE',
            pathname: '/docs/index',
            filePath: staticPagePath,
            immutableHash: undefined,
          },
          {
            id: '/404',
            type: 'STATIC_FILE',
            pathname: '/docs/404',
            filePath: notFoundPagePath,
            immutableHash: undefined,
          },
          {
            id: '/500',
            type: 'STATIC_FILE',
            pathname: '/docs/500',
            filePath: errorPagePath,
            immutableHash: undefined,
          },
          {
            id: '/de/404',
            type: 'STATIC_FILE',
            pathname: '/docs/de/404',
            filePath: localizedNotFoundPagePath,
            immutableHash: undefined,
          },
        ],
      },
    });

    expect(await readAssetManifest(projectDir)).toEqual({
      version: 1,
      assets: [
        {
          source: '.next/server/pages/index.html',
          path: '/docs',
          headers: { 'content-type': 'text/html; charset=utf-8' },
        },
        {
          source: '.next/server/pages/404.html',
          path: '/docs/404',
          status: 404,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        },
        {
          source: '.next/server/pages/500.html',
          path: '/docs/500',
          status: 500,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        },
        {
          source: '.next/server/pages/de/404.html',
          path: '/docs/de/404',
          status: 404,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        },
      ],
    });
  });

  it('keeps per-route runtime bypasses server-backed while allowing a build-wide preview token', async () => {
    const projectDir = await mkdtemp(path.join(os.tmpdir(), 'network-next-runtime-bypass-'));
    temporaryDirectories.push(projectDir);
    const distDir = path.join(projectDir, '.next');
    const prerenderDirectory = path.join(distDir, 'server', 'app');
    await mkdir(prerenderDirectory, { recursive: true });

    const prerenders = await Promise.all(
      ['server-action', 'preview'].map(async (id, index) => {
        const filePath = path.join(prerenderDirectory, `${id}.html`);
        await writeFile(filePath, `<html>${id}</html>`);
        return {
          id,
          type: 'PRERENDER' as const,
          pathname: `/${id}`,
          parentOutputId: id,
          groupId: index,
          fallback: { filePath, initialRevalidate: false as const },
          config: index === 0 ? { bypassFor: [] } : { bypassToken: 'preview-token' },
        };
      })
    );

    await onBuildComplete({
      projectDir,
      repoRoot: projectDir,
      distDir,
      config: nextConfig(),
      nextVersion: '16.2.10',
      buildId: 'build-id',
      routing: emptyRouting,
      outputs: { ...emptyOutputs, prerenders },
    });

    expect((await readAssetManifest(projectDir))?.assets).toEqual([
      { source: '.next/server/app/preview.html', path: '/preview' },
    ]);
    expect((await readPrerenderManifest(projectDir))?.prerenders).toHaveLength(2);
  });

  it('keeps Pages Router prerenders server-backed for on-demand revalidation', async () => {
    const projectDir = await mkdtemp(path.join(os.tmpdir(), 'network-next-pages-revalidation-'));
    temporaryDirectories.push(projectDir);
    const distDir = path.join(projectDir, '.next');
    const filePath = path.join(distDir, 'server', 'pages', 'products.html');
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, '<html>products</html>');

    await onBuildComplete({
      projectDir,
      repoRoot: projectDir,
      distDir,
      config: nextConfig(),
      nextVersion: '16.2.10',
      buildId: 'build-id',
      routing: emptyRouting,
      outputs: {
        ...emptyOutputs,
        prerenders: [
          {
            id: 'products',
            type: 'PRERENDER',
            pathname: '/products',
            parentOutputId: 'products',
            groupId: 1,
            fallback: { filePath, initialRevalidate: false },
            config: { bypassToken: 'preview-token' },
          },
        ],
      },
    });

    expect((await readAssetManifest(projectDir))?.assets).toEqual([]);
    expect((await readPrerenderManifest(projectDir))?.prerenders).toHaveLength(1);
  });

  it('rejects duplicate static asset paths during sidecar generation', async () => {
    const projectDir = await mkdtemp(path.join(os.tmpdir(), 'network-next-duplicate-assets-'));
    temporaryDirectories.push(projectDir);
    const distDir = path.join(projectDir, '.next');
    const outputDirectory = path.join(distDir, 'server', 'app');
    const staticFilePath = path.join(outputDirectory, 'static.html');
    const prerenderFilePath = path.join(outputDirectory, 'prerender.html');
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(staticFilePath, '<html>static</html>');
    await writeFile(prerenderFilePath, '<html>prerender</html>');

    await expect(
      onBuildComplete({
        projectDir,
        repoRoot: projectDir,
        distDir,
        config: nextConfig(),
        nextVersion: '16.2.10',
        buildId: 'build-id',
        routing: emptyRouting,
        outputs: {
          ...emptyOutputs,
          staticFiles: [
            {
              id: 'static',
              type: 'STATIC_FILE',
              pathname: '/collision',
              filePath: staticFilePath,
              immutableHash: undefined,
            },
          ],
          prerenders: [
            {
              id: 'prerender',
              type: 'PRERENDER',
              pathname: '/collision',
              parentOutputId: 'prerender',
              groupId: 1,
              fallback: { filePath: prerenderFilePath, initialRevalidate: false },
              config: { bypassToken: 'preview-token' },
            },
          ],
        },
      })
    ).rejects.toThrow('Duplicate Next.js static asset path: /collision');
  });

  it('keeps high-cardinality outputs in sidecars', async () => {
    const projectDir = await mkdtemp(path.join(os.tmpdir(), 'network-next-sidecars-'));
    temporaryDirectories.push(projectDir);
    const distDir = path.join(projectDir, '.next');
    const prerenderDirectory = path.join(distDir, 'server', 'app', 'docs');
    await mkdir(prerenderDirectory, { recursive: true });

    const prerenders = await Promise.all(
      Array.from({ length: 75 }, async (_, index) => {
        const filePath = path.join(prerenderDirectory, `${index}.html`);
        await writeFile(filePath, `<html>${index}</html>`);
        return {
          id: `docs-${index}`,
          type: 'PRERENDER',
          pathname: `/docs/${index}`,
          parentOutputId: 'docs',
          groupId: index,
          fallback: {
            filePath,
            initialRevalidate: false,
            ...(index === 0
              ? {
                  initialStatus: 203,
                  initialHeaders: {
                    'content-type': 'text/html; charset=utf-8',
                    'x-public': 'kept',
                    'X-Next-Cache-Tags': 'docs,docs:0',
                    'x-nextjs-prerender': '1',
                  },
                }
              : {}),
          },
          config: { bypassToken: 'preview-token' },
        };
      })
    );

    await onBuildComplete({
      projectDir,
      repoRoot: projectDir,
      distDir,
      config: nextConfig(),
      nextVersion: '16.2.10',
      buildId: 'build-id',
      routing: emptyRouting,
      outputs: { ...emptyOutputs, prerenders },
    });

    const manifest = (await readManifest(projectDir)) as GigadriveNextBuildManifestV2Standalone;
    expect(manifest.outputs.prerenders).toEqual([]);
    expect(manifest.outputs.entryPagePaths).toHaveLength(50);
    expect((await readPrerenderManifest(projectDir))?.prerenders).toHaveLength(75);
    const assets = (await readAssetManifest(projectDir))?.assets;
    expect(assets).toHaveLength(75);
    expect(assets?.[0]).toEqual({
      source: '.next/server/app/docs/0.html',
      path: '/docs/0',
      status: 203,
      headers: { 'content-type': 'text/html; charset=utf-8', 'x-public': 'kept' },
    });
  });

  it('writes a minimal export manifest for static export on the managed runtime', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'network-next-export-'));
    temporaryDirectories.push(repoRoot);
    const projectDir = repoRoot;
    const distDir = path.join(projectDir, '.next');
    await mkdir(projectDir, { recursive: true });

    await onBuildComplete({
      projectDir,
      repoRoot,
      distDir,
      config: nextConfig({ output: 'export' }),
      nextVersion: '16.2.10',
      buildId: 'export-build',
      routing: emptyRouting,
      outputs: emptyOutputs,
    });

    expect(await readManifest(projectDir)).toEqual({
      version: 2,
      mode: 'export',
      distDir: '.next',
      repoRootToProject: '.',
      nextVersion: '16.2.10',
      buildId: 'export-build',
    });
  });

  it('rejects a prerender fallback outside the repository root', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'network-next-adapter-safe-'));
    const outsideRoot = await mkdtemp(path.join(os.tmpdir(), 'network-next-adapter-outside-'));
    temporaryDirectories.push(repoRoot, outsideRoot);
    const projectDir = path.join(repoRoot, 'app');
    const outsideFallback = path.join(outsideRoot, 'shell.html');
    await mkdir(projectDir, { recursive: true });
    await writeFile(outsideFallback, '<html>escaped</html>');

    await expect(
      onBuildComplete({
        projectDir,
        repoRoot,
        distDir: path.join(projectDir, '.next'),
        config: nextConfig(),
        nextVersion: '16.2.10',
        buildId: 'build-id',
        routing: emptyRouting,
        outputs: {
          ...emptyOutputs,
          prerenders: [
            {
              id: 'unsafe',
              type: 'PRERENDER',
              pathname: '/',
              parentOutputId: 'p',
              groupId: 0,
              fallback: { filePath: outsideFallback },
              config: {},
            },
          ],
        },
      })
    ).rejects.toThrow('outside the repository root');
  });

  const stubCollectBuildTraces = async (projectDir: string) => {
    const buildDir = path.join(projectDir, 'node_modules', 'next', 'dist', 'build');
    await mkdir(buildDir, { recursive: true });
    await writeFile(
      path.join(projectDir, 'node_modules', 'next', 'package.json'),
      JSON.stringify({ name: 'next', version: '16.3.0', main: 'index.js' })
    );
    await writeFile(
      path.join(buildDir, 'collect-build-traces.js'),
      `const { writeFileSync } = require('node:fs');
const { join } = require('node:path');
exports.collectBuildTraces = async (options) => {
  writeFileSync(join(options.distDir, 'collect-options.json'), JSON.stringify(options));
  writeFileSync(join(options.distDir, 'next-server.js.nft.json'), JSON.stringify({ version: 1, files: [] }));
  writeFileSync(join(options.distDir, 'next-minimal-server.js.nft.json'), JSON.stringify({ version: 1, files: [] }));
};
`
    );
  };

  it('regenerates the aggregate server trace when a Next 16.3 Turbopack build omits it', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'network-next-trace-regen-'));
    temporaryDirectories.push(repoRoot);
    const projectDir = path.join(repoRoot, 'apps', 'web');
    const distDir = path.join(projectDir, '.next');
    await mkdir(distDir, { recursive: true });
    await stubCollectBuildTraces(projectDir);

    await onBuildComplete({
      projectDir,
      repoRoot,
      distDir,
      config: nextConfig({ output: 'standalone' }),
      nextVersion: '16.3.0',
      buildId: 'build-id',
      routing: emptyRouting,
      outputs: emptyOutputs,
    });

    const options = JSON.parse(await readFile(path.join(distDir, 'collect-options.json'), 'utf8'));
    expect(options).toMatchObject({
      dir: projectDir,
      distDir,
      edgeRuntimeRoutes: {},
      staticPages: [],
      // Falls back to repoRoot when the config does not carry outputFileTracingRoot.
      outputFileTracingRoot: repoRoot,
    });
    expect(await readFile(path.join(distDir, 'next-server.js.nft.json'), 'utf8')).toContain('"version":1');
    expect(await readManifest(projectDir)).toMatchObject({ version: 2, mode: 'standalone-v2' });
  });

  it('does not touch build traces when Next already emitted the aggregate file', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'network-next-trace-present-'));
    temporaryDirectories.push(repoRoot);
    const projectDir = path.join(repoRoot, 'apps', 'web');
    const distDir = path.join(projectDir, '.next');
    await mkdir(distDir, { recursive: true });
    // No stub Next module exists: regeneration would throw if it were attempted.
    await writeFile(path.join(distDir, 'next-server.js.nft.json'), JSON.stringify({ version: 1, files: [] }));

    await onBuildComplete({
      projectDir,
      repoRoot,
      distDir,
      config: nextConfig({ output: 'standalone', outputFileTracingRoot: repoRoot }),
      nextVersion: '16.2.12',
      buildId: 'build-id',
      routing: emptyRouting,
      outputs: emptyOutputs,
    });

    expect(await readManifest(projectDir)).toMatchObject({ version: 2, mode: 'standalone-v2' });
  });

  it('fails loudly when the aggregate trace is missing and Next cannot regenerate it', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'network-next-trace-missing-'));
    temporaryDirectories.push(repoRoot);
    const projectDir = path.join(repoRoot, 'apps', 'web');
    const distDir = path.join(projectDir, '.next');
    const buildDir = path.join(projectDir, 'node_modules', 'next', 'dist', 'build');
    await mkdir(distDir, { recursive: true });
    await mkdir(buildDir, { recursive: true });
    await writeFile(
      path.join(projectDir, 'node_modules', 'next', 'package.json'),
      JSON.stringify({ name: 'next', version: '16.3.0', main: 'index.js' })
    );
    await writeFile(path.join(buildDir, 'collect-build-traces.js'), `throw new Error('module removed');`);

    await expect(
      onBuildComplete({
        projectDir,
        repoRoot,
        distDir,
        config: nextConfig({ output: 'standalone' }),
        nextVersion: '16.3.0',
        buildId: 'build-id',
        routing: emptyRouting,
        outputs: emptyOutputs,
      })
    ).rejects.toThrow('could not load next/dist/build/collect-build-traces');
  });
});

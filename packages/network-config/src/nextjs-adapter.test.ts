import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import gigadriveNextAdapter from './nextjs-adapter';
import { parseGigadriveNextBuildManifest, type GigadriveNextBuildManifestV2Standalone } from './nextjs-manifest';

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
    await mkdir(path.dirname(fallbackPath), { recursive: true });
    await writeFile(fallbackPath, '<html>isr</html>');

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
        ],
        staticFiles: [],
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
        staticAssets: [{ sourceDir: '.next/static', urlPrefix: '_next/static', immutable: true }],
      },
    });
    expect(manifest.outputs.prerenders).toHaveLength(1);
    expect(manifest.outputs.prerenders[0]).toMatchObject({
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
    // No per-route entrypoints or wrappers exist in the single-server model.
    expect((manifest as unknown as Record<string, unknown>).entrypoints).toBeUndefined();
    expect((manifest as unknown as Record<string, unknown>).outputEntrypoints).toBeUndefined();
    await expect(readFile(path.join(projectDir, '.gigadrive', 'nextjs', 'entrypoints'))).rejects.toThrow();
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
});

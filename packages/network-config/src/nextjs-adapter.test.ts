import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import gigadriveNextAdapter from './nextjs-adapter';
import { parseGigadriveNextBuildManifest, type GigadriveNextBuildManifestV2 } from './nextjs-manifest';

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

const modifyConfig = (config: Record<string, unknown>, phase: string, nextVersion: string) => {
  if (!gigadriveNextAdapter.modifyConfig) throw new Error('Expected modifyConfig');
  return (
    gigadriveNextAdapter.modifyConfig as unknown as (
      config: Record<string, unknown>,
      context: { phase: string; nextVersion: string }
    ) => Record<string, unknown>
  )(config, { phase, nextVersion });
};

const onBuildComplete = async (context: Record<string, unknown>): Promise<void> => {
  if (!gigadriveNextAdapter.onBuildComplete) throw new Error('Expected onBuildComplete');
  await (gigadriveNextAdapter.onBuildComplete as unknown as (context: Record<string, unknown>) => Promise<void>)(
    context
  );
};

afterEach(async () => {
  delete process.env.GIGADRIVE_DEPLOYMENT_ID;
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('Gigadrive Next.js adapter', () => {
  it('enables the Next 16 platform cache and image loader without forcing standalone output', () => {
    const config = nextConfig({ reactStrictMode: true });
    process.env.GIGADRIVE_DEPLOYMENT_ID = 'deployment-id';

    const result = modifyConfig(config, 'phase-production-build', '16.2.10');

    expect(result).toMatchObject({
      reactStrictMode: true,
      deploymentId: 'deployment-id',
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
    expect(result.output).toBeUndefined();
    expect(result.cacheHandler).toEqual(expect.stringContaining('nextjs-cache-handler.js'));
    expect(config.output).toBeUndefined();
  });

  it('preserves development, static export, and explicit user runtime integrations', () => {
    const developmentConfig = nextConfig({ reactStrictMode: true });
    const exportConfig = nextConfig({ output: 'export', trailingSlash: true });
    const customConfig = nextConfig({
      cacheHandler: '/user/cache.js',
      cacheHandlers: { remote: '/user/components.js' },
      cacheMaxMemorySize: 1024,
      images: { ...nextConfig().images, loader: 'custom', loaderFile: '/user/image.js' },
    });

    expect(modifyConfig(developmentConfig, 'phase-development-server', '16.2.10')).toBe(developmentConfig);
    expect(modifyConfig(exportConfig, 'phase-production-build', '16.2.10')).toEqual(exportConfig);
    expect(modifyConfig(customConfig, 'phase-production-build', '16.2.10')).toEqual(customConfig);
  });

  it('retains standalone output for Next 14 and 15', () => {
    expect(modifyConfig(nextConfig(), 'phase-production-build', '15.5.20')).toMatchObject({ output: 'standalone' });
    expect(modifyConfig(nextConfig({ output: 'export' }), 'phase-production-build', '14.2.0')).toMatchObject({
      output: 'export',
    });
  });

  it('writes a portable v2 plan, deduplicates executable outputs, and generates a direct handler wrapper', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'network-next-adapter-'));
    temporaryDirectories.push(repoRoot);
    const projectDir = path.join(repoRoot, 'apps', 'web');
    const distDir = path.join(projectDir, '.next-custom');
    const handlerPath = path.join(distDir, 'server', 'app.js');
    const sharedPath = path.join(distDir, 'server', 'chunks', 'shared.js');
    const tracedPackagePath = path.join(repoRoot, 'node_modules', '@swc', 'helpers');
    const tracedPackageModulePath = path.join(tracedPackagePath, 'cjs', 'index.js');
    const staticPath = path.join(distDir, 'static', 'app.js');
    await mkdir(path.dirname(sharedPath), { recursive: true });
    await mkdir(path.dirname(tracedPackageModulePath), { recursive: true });
    await mkdir(path.dirname(staticPath), { recursive: true });
    await writeFile(handlerPath, 'export async function handler() {}');
    await writeFile(sharedPath, 'export const shared = true');
    await writeFile(path.join(tracedPackagePath, 'package.json'), '{"name":"@swc/helpers"}');
    await writeFile(tracedPackageModulePath, 'module.exports = {}');
    await writeFile(staticPath, 'console.log("static")');

    const commonOutput = {
      filePath: handlerPath,
      sourcePage: 'app/page.tsx',
      runtime: 'nodejs',
      assets: {
        'apps/web/.next-custom/server/chunks/shared.js': sharedPath,
        'node_modules/@swc/helpers': tracedPackagePath,
      },
      config: { maxDuration: 45, preferredRegion: ['fra1'] },
    };
    await onBuildComplete({
      projectDir,
      repoRoot,
      distDir,
      config: nextConfig(),
      nextVersion: '16.2.10',
      buildId: 'build-id',
      routing: {
        beforeMiddleware: [{ sourceRegex: '^/old$', destination: '/new' }],
        beforeFiles: [],
        afterFiles: [],
        dynamicRoutes: [{ sourceRegex: '^/blog/([^/]+)$' }],
        onMatch: [],
        fallback: [],
        shouldNormalizeNextData: true,
        rsc: { header: 'rsc' },
      },
      outputs: {
        pages: [{ ...commonOutput, id: 'page-html', type: 'PAGES', pathname: '/page' }],
        pagesApi: [],
        appPages: [{ ...commonOutput, id: 'page-rsc', type: 'APP_PAGE', pathname: '/page.rsc' }],
        appRoutes: [],
        prerenders: [],
        staticFiles: [
          { id: 'static-app', type: 'STATIC_FILE', filePath: staticPath, pathname: '/_next/static/app.js' },
        ],
      },
    });

    const content = await readFile(path.join(projectDir, '.gigadrive', 'nextjs.json'), 'utf8');
    const manifest = parseGigadriveNextBuildManifest(content) as GigadriveNextBuildManifestV2;
    expect(manifest).toMatchObject({
      version: 2,
      mode: 'adapter-v2',
      distDir: '.next-custom',
      repoRootToProject: 'apps/web',
      nextVersion: '16.2.10',
      buildId: 'build-id',
      outputEntrypoints: { 'page-html': 'next-0', 'page-rsc': 'next-0' },
      routing: { shouldNormalizeNextData: true },
      config: { images: { localPatterns: [{ pathname: '/images/**' }], qualities: [75] } },
    });
    expect(manifest.entrypoints).toHaveLength(1);
    expect(manifest.entrypoints[0]).toMatchObject({
      id: 'next-0',
      runtime: 'nodejs',
      outputIds: ['page-html', 'page-rsc'],
      assets: {
        'node_modules/@swc/helpers': 'node_modules/@swc/helpers',
      },
      config: { maxDuration: 45, preferredRegion: ['fra1'] },
    });
    const wrapperPath = path.join(repoRoot, manifest.entrypoints[0].filePath);
    expect(await readFile(wrapperPath, 'utf8')).toContain('await nextHandler(req, res');
  });

  it('rejects outputs outside the repository root', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'network-next-adapter-safe-'));
    const outsideRoot = await mkdtemp(path.join(os.tmpdir(), 'network-next-adapter-outside-'));
    temporaryDirectories.push(repoRoot, outsideRoot);
    const projectDir = path.join(repoRoot, 'app');
    const outsideHandler = path.join(outsideRoot, 'handler.js');
    await mkdir(projectDir, { recursive: true });
    await writeFile(outsideHandler, 'export const handler = () => {}');

    await expect(
      onBuildComplete({
        projectDir,
        repoRoot,
        distDir: path.join(projectDir, '.next'),
        config: nextConfig(),
        nextVersion: '16.2.10',
        buildId: 'build-id',
        routing: {
          beforeMiddleware: [],
          beforeFiles: [],
          afterFiles: [],
          dynamicRoutes: [],
          onMatch: [],
          fallback: [],
          shouldNormalizeNextData: false,
          rsc: {},
        },
        outputs: {
          pages: [
            {
              id: 'unsafe',
              type: 'PAGES',
              filePath: outsideHandler,
              pathname: '/',
              sourcePage: 'pages/index.tsx',
              runtime: 'nodejs',
              assets: {},
              config: {},
            },
          ],
          pagesApi: [],
          appPages: [],
          appRoutes: [],
          prerenders: [],
          staticFiles: [],
        },
      })
    ).rejects.toThrow('outside the repository root');
  });
});

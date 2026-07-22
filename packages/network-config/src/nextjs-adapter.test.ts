import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  const projectDir = context.projectDir;
  if (typeof projectDir !== 'string') throw new Error('Expected projectDir');
  const pprRuntimePath = path.join(projectDir, '.gigadrive', 'platform', 'nextjs-ppr-runtime.js');
  await mkdir(path.dirname(pprRuntimePath), { recursive: true });
  await writeFile(
    pprRuntimePath,
    'export const persistPprCacheEntry = async () => {}; export const revalidateNextPath = async () => {};'
  );
  process.env.GIGADRIVE_NEXT_PPR_RUNTIME_PATH = pprRuntimePath;
  await (gigadriveNextAdapter.onBuildComplete as unknown as (context: Record<string, unknown>) => Promise<void>)(
    context
  );
};

afterEach(async () => {
  delete process.env.GIGADRIVE_DEPLOYMENT_ID;
  delete process.env.GIGADRIVE_NEXT_PPR_RUNTIME_PATH;
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

    const manifest = parseGigadriveNextBuildManifest(
      await readFile(path.join(projectDir, '.gigadrive', 'nextjs.json'), 'utf8')
    );
    expect(manifest).toEqual({
      version: 1,
      output: 'standalone',
      distDir: '.next',
      repoRootToProject: 'apps/web',
      nextVersion: '16.1.6',
      buildId: 'next-16-1-build',
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
    const platformRuntimeDirectory = path.join(projectDir, '.gigadrive', 'platform');
    const cacheHandlerPath = path.join(platformRuntimeDirectory, 'nextjs-cache-handler.js');
    const cacheComponentsHandlerPath = path.join(platformRuntimeDirectory, 'nextjs-cache-components-handler.js');
    const imageLoaderPath = path.join(platformRuntimeDirectory, 'nextjs-image-loader.js');
    await mkdir(path.dirname(sharedPath), { recursive: true });
    await mkdir(path.dirname(tracedPackageModulePath), { recursive: true });
    await mkdir(path.dirname(staticPath), { recursive: true });
    await mkdir(platformRuntimeDirectory, { recursive: true });
    await writeFile(handlerPath, 'export async function handler() {}');
    await writeFile(sharedPath, 'export const shared = true');
    await writeFile(path.join(tracedPackagePath, 'package.json'), '{"name":"@swc/helpers"}');
    await writeFile(tracedPackageModulePath, 'module.exports = {}');
    await writeFile(staticPath, 'console.log("static")');
    await writeFile(cacheHandlerPath, 'export default class CacheHandler {}');
    await writeFile(cacheComponentsHandlerPath, 'export default class CacheComponentsHandler {}');
    await writeFile(imageLoaderPath, 'export default function loader() {}');

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
      config: nextConfig({
        cacheHandler: cacheHandlerPath,
        cacheHandlers: { default: cacheComponentsHandlerPath, remote: cacheComponentsHandlerPath },
        images: { ...nextConfig().images, loader: 'custom', loaderFile: imageLoaderPath },
      }),
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
        'apps/web/.gigadrive/platform/nextjs-cache-handler.js': 'apps/web/.gigadrive/platform/nextjs-cache-handler.js',
        'apps/web/.gigadrive/platform/nextjs-cache-components-handler.js':
          'apps/web/.gigadrive/platform/nextjs-cache-components-handler.js',
        'apps/web/.gigadrive/platform/nextjs-image-loader.js': 'apps/web/.gigadrive/platform/nextjs-image-loader.js',
        'apps/web/.gigadrive/platform/nextjs-ppr-runtime.js': 'apps/web/.gigadrive/platform/nextjs-ppr-runtime.js',
      },
      config: { maxDuration: 45, preferredRegion: ['fra1'] },
    });
    const wrapperPath = path.join(repoRoot, manifest.entrypoints[0].filePath);
    const wrapper = await readFile(wrapperPath, 'utf8');
    expect(wrapper).toContain('next/dist/build/adapter/setup-node-env.external.js');
    expect(wrapper).toContain('await nextHandler(req, res');
    expect(wrapper).toContain('onCacheEntryV2');
    expect(wrapper).toContain('persistPprCacheEntry');
    expect(wrapper).toContain('revalidateNextPath');
    expect(wrapper).toContain('revalidate(input) { return revalidateNextPath');
    expect(wrapper).not.toContain('routerServerContext:');
    expect(wrapper).toContain("req.headers['x-gigadrive-next-cache-key']");
  });

  it('invokes Node.js middleware with the Web Request adapter contract', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'network-next-middleware-'));
    temporaryDirectories.push(repoRoot);
    const projectDir = path.join(repoRoot, 'app');
    const distDir = path.join(projectDir, '.next');
    const middlewarePath = path.join(distDir, 'server', 'middleware.js');
    await mkdir(path.dirname(middlewarePath), { recursive: true });
    await writeFile(
      middlewarePath,
      `module.exports.handler = async (request, context) => {
        context.waitUntil(Promise.resolve());
        return Response.json({
          method: request.method,
          pathname: new URL(request.url).pathname,
          invocationTarget: context.requestMeta.invocationTarget,
        }, { headers: { 'x-middleware-next': '1' } });
      };`
    );

    await onBuildComplete({
      projectDir,
      repoRoot,
      distDir,
      config: nextConfig(),
      nextVersion: '16.2.10',
      buildId: 'middleware-build',
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
        pages: [],
        pagesApi: [],
        appPages: [],
        appRoutes: [],
        middleware: {
          id: '/_middleware',
          type: 'MIDDLEWARE',
          filePath: middlewarePath,
          pathname: '/_middleware',
          sourcePage: 'middleware',
          runtime: 'nodejs',
          assets: {},
          config: {},
        },
        prerenders: [],
        staticFiles: [],
      },
    });

    const manifest = parseGigadriveNextBuildManifest(
      await readFile(path.join(projectDir, '.gigadrive', 'nextjs.json'), 'utf8')
    ) as GigadriveNextBuildManifestV2;
    const wrapperPath = path.join(repoRoot, manifest.entrypoints[0].filePath);
    const wrapper = (await import(`${wrapperPath}?test=${String(Date.now())}`)) as {
      fetch(request: Request): Promise<Response>;
    };
    const response = await wrapper.fetch(
      new Request('https://example.com/api/echo', {
        headers: { 'x-gigadrive-next-invocation-target': '/api/echo' },
      })
    );

    expect(response.headers.get('x-middleware-next')).toBe('1');
    await expect(response.json()).resolves.toEqual({
      method: 'GET',
      pathname: '/api/echo',
      invocationTarget: '/api/echo',
    });
  });

  it('awaits asynchronous Turbopack Node entrypoint exports before resolving the handler', async () => {
    const repoRoot = await mkdtemp(path.join(process.cwd(), '.tmp-network-next-turbopack-'));
    temporaryDirectories.push(repoRoot);
    const projectDir = path.join(repoRoot, 'app');
    const distDir = path.join(projectDir, '.next');
    const handlerPath = path.join(distDir, 'server', 'app', 'api', 'async', 'route.cjs');
    await mkdir(path.dirname(handlerPath), { recursive: true });
    await writeFile(
      handlerPath,
      `module.exports = Promise.resolve({
        handler: async (request, response, context) => {
          response.statusCode = 200;
          response.body = request.url;
          context.waitUntil(Promise.resolve().then(() => { response.waitUntilSettled = true; }));
        },
      });`
    );

    await onBuildComplete({
      projectDir,
      repoRoot,
      distDir,
      config: nextConfig(),
      nextVersion: '16.2.10',
      buildId: 'turbopack-build',
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
        pages: [],
        pagesApi: [],
        appPages: [],
        appRoutes: [
          {
            id: 'app/api/async/route',
            type: 'APP_ROUTE',
            filePath: handlerPath,
            pathname: '/api/async',
            sourcePage: 'app/api/async/route.ts',
            runtime: 'nodejs',
            assets: {},
            config: {},
          },
        ],
        prerenders: [],
        staticFiles: [],
      },
    });

    const manifest = parseGigadriveNextBuildManifest(
      await readFile(path.join(projectDir, '.gigadrive', 'nextjs.json'), 'utf8')
    ) as GigadriveNextBuildManifestV2;
    const wrapperPath = path.join(repoRoot, manifest.entrypoints[0].filePath);
    const wrapper = (await import(`${wrapperPath}?test=${String(Date.now())}`)) as {
      default(
        request: { headers: Record<string, string>; url: string },
        response: { statusCode?: number; body?: string; waitUntilSettled?: boolean }
      ): Promise<void>;
    };
    const response: { statusCode?: number; body?: string; waitUntilSettled?: boolean } = {};

    await wrapper.default({ headers: { host: 'example.com' }, url: '/api/async' }, response);

    expect(response).toEqual({ statusCode: 200, body: '/api/async', waitUntilSettled: true });
  });

  it('loads canonical Turbopack Edge assets before invoking the registered handler', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'network-next-edge-'));
    temporaryDirectories.push(repoRoot);
    const projectDir = path.join(repoRoot, 'app');
    const distDir = path.join(projectDir, '.next');
    const requiredServerFilesPath = path.join(distDir, 'required-server-files.js');
    const edgeChunksDirectory = path.join(distDir, 'server', 'edge', 'chunks');
    const dependencyChunkPath = path.join(edgeChunksDirectory, 'dependency.js');
    const runtimeModulePath = path.join(edgeChunksDirectory, 'runtime.js');
    await mkdir(edgeChunksDirectory, { recursive: true });
    await writeFile(requiredServerFilesPath, 'self.__SERVER_FILES_MANIFEST = { loaded: true };');
    await writeFile(dependencyChunkPath, 'globalThis.__edgeDependencyLoaded = true;');
    await writeFile(
      runtimeModulePath,
      `if (!self.__SERVER_FILES_MANIFEST?.loaded || !globalThis.__edgeDependencyLoaded) {
        throw new Error('Edge dependencies were not evaluated first');
      }
      globalThis._ENTRIES = {
        edge_test: Promise.resolve({
          handler: async (request) => Response.json({ pathname: new URL(request.url).pathname }),
        }),
      };`
    );

    await onBuildComplete({
      projectDir,
      repoRoot,
      distDir,
      config: nextConfig(),
      nextVersion: '16.2.10',
      buildId: 'edge-build',
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
        pages: [],
        pagesApi: [],
        appPages: [],
        appRoutes: [
          {
            id: 'app/api/edge/route',
            type: 'APP_ROUTE',
            filePath: runtimeModulePath,
            pathname: '/api/edge',
            sourcePage: 'app/api/edge/route.ts',
            runtime: 'edge',
            assets: {
              'required-server-files.js': requiredServerFilesPath,
              'server/edge/chunks/dependency.js': dependencyChunkPath,
              'server/edge/chunks/runtime.js': runtimeModulePath,
            },
            wasmAssets: {},
            edgeRuntime: {
              modulePath: runtimeModulePath,
              entryKey: 'edge_test',
              handlerExport: 'handler',
            },
            config: {},
          },
        ],
        prerenders: [],
        staticFiles: [],
      },
    });

    const manifest = parseGigadriveNextBuildManifest(
      await readFile(path.join(projectDir, '.gigadrive', 'nextjs.json'), 'utf8')
    ) as GigadriveNextBuildManifestV2;
    expect(manifest.entrypoints[0].assets).toMatchObject({
      'required-server-files.js': 'app/.next/required-server-files.js',
      'server/edge/chunks/dependency.js': 'app/.next/server/edge/chunks/dependency.js',
    });

    const archiveRoot = await mkdtemp(path.join(os.tmpdir(), 'network-next-adapter-archive-'));
    temporaryDirectories.push(archiveRoot);
    const entrypoint = manifest.entrypoints[0];
    for (const [targetPath, sourcePath] of Object.entries(entrypoint.assets)) {
      const archivePath = path.join(archiveRoot, targetPath);
      await mkdir(path.dirname(archivePath), { recursive: true });
      await copyFile(path.join(repoRoot, sourcePath), archivePath);
    }
    const canonicalRuntimePath = path.join(archiveRoot, entrypoint.edgeRuntime!.modulePath);
    await mkdir(path.dirname(canonicalRuntimePath), { recursive: true });
    await copyFile(runtimeModulePath, canonicalRuntimePath);
    const wrapperPath = path.join(archiveRoot, entrypoint.filePath);
    await expect(readFile(wrapperPath, 'utf8')).resolves.toContain(
      'await import("../../../.next/server/edge/chunks/runtime.js")'
    );
    const wrapper = (await import(`${wrapperPath}?test=${String(Date.now())}`)) as {
      fetch(request: Request): Promise<Response>;
    };
    const response = await wrapper.fetch(new Request('https://example.com/api/edge'));

    await expect(response.json()).resolves.toEqual({ pathname: '/api/edge' });
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

import type { NextAdapter } from 'next';
import { access, mkdir, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedImagePolicy } from './image-policy';
import type {
  GigadriveNextBuildManifestV2,
  GigadriveNextEntrypoint,
  GigadriveNextRouteOutput,
  GigadriveNextStaticOutput,
  JsonValue,
} from './nextjs-manifest';

type BuildCompleteContext = Parameters<NonNullable<NextAdapter['onBuildComplete']>>[0];
type NextRouteOutput =
  | BuildCompleteContext['outputs']['pages'][number]
  | BuildCompleteContext['outputs']['pagesApi'][number]
  | BuildCompleteContext['outputs']['appPages'][number]
  | BuildCompleteContext['outputs']['appRoutes'][number]
  | NonNullable<BuildCompleteContext['outputs']['middleware']>;
type NextStaticOutput = BuildCompleteContext['outputs']['staticFiles'][number];

const PRODUCTION_BUILD_PHASE = 'phase-production-build';
const runtimeDirectory = typeof __dirname === 'string' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

const runtimeModulePath = (environmentName: string, fileName: string): string =>
  process.env[environmentName] ?? path.join(runtimeDirectory, fileName);

const CACHE_HANDLER_PATH = () => runtimeModulePath('GIGADRIVE_NEXT_CACHE_HANDLER_PATH', 'nextjs-cache-handler.js');
const CACHE_COMPONENTS_HANDLER_PATH = () =>
  runtimeModulePath('GIGADRIVE_NEXT_CACHE_COMPONENTS_HANDLER_PATH', 'nextjs-cache-components-handler.js');
const IMAGE_LOADER_PATH = () => runtimeModulePath('GIGADRIVE_NEXT_IMAGE_LOADER_PATH', 'nextjs-image-loader.js');

const toJsonValue = (value: unknown): JsonValue => {
  const serialized = JSON.stringify(value);
  return serialized === undefined ? null : (JSON.parse(serialized) as JsonValue);
};

const isNext16OrNewer = (nextVersion: string): boolean => {
  const major = Number.parseInt(nextVersion.split('.')[0] ?? '', 10);
  return Number.isFinite(major) && major >= 16;
};

const toPortableRelativePath = (from: string, to: string, allowCurrentDirectory = false): string => {
  const resolvedFrom = path.resolve(from);
  const resolvedTo = path.resolve(path.isAbsolute(to) ? to : path.join(from, to));
  const relativePath = path.relative(resolvedFrom, resolvedTo).replaceAll(path.sep, '/');
  const normalized = relativePath === '' ? '.' : relativePath;
  if (
    (!allowCurrentDirectory && normalized === '.') ||
    normalized.startsWith('/') ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized.split('/').some((segment) => segment === '..')
  ) {
    throw new Error(`Next.js adapter output is outside the repository root: ${to}`);
  }
  return normalized;
};

const resolveReadablePath = async (repoRoot: string, filePath: string) => {
  const absolutePath = path.resolve(path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath));
  const portablePath = toPortableRelativePath(repoRoot, absolutePath);
  await access(absolutePath);
  const resolvedPath = await realpath(absolutePath);
  toPortableRelativePath(repoRoot, resolvedPath);
  const fileStat = await stat(absolutePath);
  return { portablePath, fileStat };
};

const requireReadableFile = async (repoRoot: string, filePath: string): Promise<string> => {
  const { portablePath, fileStat } = await resolveReadablePath(repoRoot, filePath);
  if (!fileStat.isFile()) throw new Error(`Next.js adapter output is not a readable file: ${filePath}`);
  return portablePath;
};

const requireReadableAsset = async (repoRoot: string, filePath: string): Promise<string> => {
  const { portablePath, fileStat } = await resolveReadablePath(repoRoot, filePath);
  if (!fileStat.isFile() && !fileStat.isDirectory()) {
    throw new Error(`Next.js adapter asset is not a readable file or directory: ${filePath}`);
  }
  return portablePath;
};

const serializeFileMap = async (repoRoot: string, files: Record<string, string>): Promise<Record<string, string>> => {
  const entries = await Promise.all(
    Object.entries(files).map(async ([targetPath, sourcePath]) => [
      toPortableRelativePath(repoRoot, targetPath),
      await requireReadableAsset(repoRoot, sourcePath),
    ])
  );
  return Object.fromEntries(entries);
};

const serializeRouteOutput = async (repoRoot: string, output: NextRouteOutput): Promise<GigadriveNextRouteOutput> => {
  const matchers = (
    output.config as typeof output.config & {
      matchers?: Array<{
        source: string;
        sourceRegex: string;
        has?: unknown[];
        missing?: unknown[];
      }>;
    }
  ).matchers;
  return {
    id: output.id,
    type: String(output.type) as GigadriveNextRouteOutput['type'],
    filePath: await requireReadableFile(repoRoot, output.filePath),
    pathname: output.pathname,
    sourcePage: output.sourcePage,
    runtime: output.runtime,
    assets: await serializeFileMap(repoRoot, output.assets),
    ...(output.wasmAssets ? { wasmAssets: await serializeFileMap(repoRoot, output.wasmAssets) } : {}),
    ...(output.edgeRuntime
      ? {
          edgeRuntime: {
            modulePath: await requireReadableFile(repoRoot, output.edgeRuntime.modulePath),
            entryKey: output.edgeRuntime.entryKey,
            handlerExport: output.edgeRuntime.handlerExport,
          },
        }
      : {}),
    config: {
      maxDuration: output.config.maxDuration,
      preferredRegion: output.config.preferredRegion,
      env: output.config.env,
      ...(matchers
        ? {
            matchers: matchers.map((matcher) => ({
              source: matcher.source,
              sourceRegex: matcher.sourceRegex,
              ...(matcher.has ? { has: toJsonValue(matcher.has) as JsonValue[] } : {}),
              ...(matcher.missing ? { missing: toJsonValue(matcher.missing) as JsonValue[] } : {}),
            })),
          }
        : {}),
    },
  };
};

const serializeStaticOutput = async (
  repoRoot: string,
  output: NextStaticOutput
): Promise<GigadriveNextStaticOutput> => ({
  id: output.id,
  type: 'STATIC_FILE',
  filePath: await requireReadableFile(repoRoot, output.filePath),
  pathname: output.pathname,
  ...(output.immutableHash ? { immutableHash: output.immutableHash } : {}),
});

const buildEntrypointPlan = (
  outputs: GigadriveNextRouteOutput[]
): Pick<GigadriveNextBuildManifestV2, 'entrypoints' | 'outputEntrypoints'> => {
  const byIdentity = new Map<string, GigadriveNextEntrypoint>();
  const outputEntrypoints: Record<string, string> = {};

  for (const output of outputs) {
    const identity = JSON.stringify([
      output.runtime,
      output.filePath,
      output.edgeRuntime?.modulePath,
      output.edgeRuntime?.entryKey,
      output.edgeRuntime?.handlerExport,
    ]);
    const existingEntrypoint = byIdentity.get(identity);
    const entrypoint: GigadriveNextEntrypoint = existingEntrypoint ?? {
      id: `next-${byIdentity.size}`,
      runtime: output.runtime,
      filePath: output.filePath,
      outputIds: [],
      assets: { ...output.assets },
      ...(output.wasmAssets ? { wasmAssets: { ...output.wasmAssets } } : {}),
      ...(output.edgeRuntime ? { edgeRuntime: { ...output.edgeRuntime } } : {}),
      config: {
        maxDuration: output.config.maxDuration,
        preferredRegion: output.config.preferredRegion,
        env: output.config.env,
      },
    };
    if (!existingEntrypoint) {
      byIdentity.set(identity, entrypoint);
    } else {
      Object.assign(entrypoint.assets, output.assets);
      if (output.wasmAssets) entrypoint.wasmAssets = { ...entrypoint.wasmAssets, ...output.wasmAssets };
      if (output.config.maxDuration !== undefined) {
        entrypoint.config.maxDuration = Math.max(entrypoint.config.maxDuration ?? 0, output.config.maxDuration);
      }
    }
    entrypoint.outputIds.push(output.id);
    outputEntrypoints[output.id] = entrypoint.id;
  }

  return { entrypoints: [...byIdentity.values()], outputEntrypoints };
};

const writeEntrypointWrappers = async (
  projectDir: string,
  repoRoot: string,
  entrypoints: GigadriveNextEntrypoint[]
): Promise<void> => {
  const wrapperDirectory = path.join(projectDir, '.gigadrive', 'nextjs', 'entrypoints');
  await mkdir(wrapperDirectory, { recursive: true });

  await Promise.all(
    entrypoints.map(async (entrypoint) => {
      const wrapperPath = path.join(wrapperDirectory, `${entrypoint.id}.mjs`);
      const executablePath = path.join(repoRoot, entrypoint.edgeRuntime?.modulePath ?? entrypoint.filePath);
      const relativeImport = path.relative(wrapperDirectory, executablePath).replaceAll(path.sep, '/');
      const importSpecifier = relativeImport.startsWith('.') ? relativeImport : `./${relativeImport}`;
      const source =
        entrypoint.runtime === 'edge' && entrypoint.edgeRuntime
          ? `import ${JSON.stringify(importSpecifier)};\n\nexport async function fetch(request) {\n  const pending = [];\n  const registry = globalThis._ENTRIES;\n  if (!registry) throw new Error('Next.js edge entry registry is unavailable');\n  const entry = await registry[${JSON.stringify(entrypoint.edgeRuntime.entryKey)}];\n  const handler = entry?.[${JSON.stringify(entrypoint.edgeRuntime.handlerExport)}];\n  if (typeof handler !== 'function') throw new Error('Next.js edge handler is unavailable');\n  const url = new URL(request.url);\n  const response = await handler(request, {\n    signal: request.signal,\n    waitUntil(promise) { pending.push(Promise.resolve(promise)); },\n    requestMeta: { hostname: url.hostname, invocationTarget: request.headers.get('x-gigadrive-next-invocation-target') ?? url.pathname, routeMatches: Object.fromEntries(new URLSearchParams(request.headers.get('x-now-route-matches') ?? '')), relativeProjectDir: ${JSON.stringify(
              toPortableRelativePath(repoRoot, projectDir, true)
            )} },\n  });\n  if (!response.body) { await Promise.allSettled(pending); return response; }\n  const reader = response.body.getReader();\n  const body = new ReadableStream({\n    async pull(controller) {\n      const result = await reader.read();\n      if (result.done) { await Promise.allSettled(pending); controller.close(); return; }\n      controller.enqueue(result.value);\n    },\n    cancel(reason) { return reader.cancel(reason); },\n  });\n  return new Response(body, response);\n}\n`
          : `import * as nextEntrypoint from ${JSON.stringify(importSpecifier)};\n\nexport default async function handler(req, res) {\n  const pending = [];\n  const nextHandler = nextEntrypoint.handler ?? nextEntrypoint.default?.handler ?? nextEntrypoint.default;\n  if (typeof nextHandler !== 'function') throw new Error('Next.js Node handler is unavailable');\n  await nextHandler(req, res, {\n    waitUntil(promise) { pending.push(Promise.resolve(promise)); },\n    requestMeta: { hostname: req.headers.host, invocationTarget: req.headers['x-gigadrive-next-invocation-target'] ?? req.url, routeMatches: Object.fromEntries(new URLSearchParams(req.headers['x-now-route-matches'] ?? '')), relativeProjectDir: ${JSON.stringify(
              toPortableRelativePath(repoRoot, projectDir, true)
            )} },\n  });\n  await Promise.allSettled(pending);\n}\n`;
      await writeFile(wrapperPath, source, 'utf8');
      const portableWrapperPath = toPortableRelativePath(repoRoot, wrapperPath);
      entrypoint.assets[portableWrapperPath] = portableWrapperPath;
      entrypoint.filePath = portableWrapperPath;
    })
  );
};

const normalizeImages = (config: BuildCompleteContext['config']): NormalizedImagePolicy | undefined => {
  if (config.images.unoptimized) return undefined;
  return {
    localPatterns: config.images.localPatterns ?? [{ pathname: '/**' }],
    remotePatterns: config.images.remotePatterns.map((pattern) => {
      if (pattern instanceof URL) {
        return {
          protocol: pattern.protocol === 'http:' ? ('http' as const) : ('https' as const),
          hostname: pattern.hostname,
          port: pattern.port,
          pathname: pattern.pathname,
          search: pattern.search,
        };
      }
      return { ...pattern };
    }),
    widths: [...new Set([...config.images.deviceSizes, ...config.images.imageSizes])].sort((a, b) => a - b),
    heights: [],
    qualities: config.images.qualities ?? [75],
    formats: config.images.formats,
    minimumCacheTTL: config.images.minimumCacheTTL,
    dangerouslyAllowSVG: config.images.dangerouslyAllowSVG,
    contentSecurityPolicy: config.images.contentSecurityPolicy,
    contentDispositionType: config.images.contentDispositionType,
    maximumRedirects: config.images.maximumRedirects,
    maximumResponseBody: config.images.maximumResponseBody,
    variants: {},
  };
};

/**
 * Next.js deployment adapter used automatically by Gigadrive Network build workers.
 *
 * Next 16 emits a portable, versioned runtime plan. Older Next versions retain the
 * standalone-server behavior so existing deployments remain compatible.
 */
const gigadriveNextAdapter: NextAdapter = {
  name: 'Gigadrive Network',

  modifyConfig(config, { phase, nextVersion }) {
    if (phase !== PRODUCTION_BUILD_PHASE) return config;

    const deploymentId = config.deploymentId ?? process.env.GIGADRIVE_DEPLOYMENT_ID;
    if (!isNext16OrNewer(nextVersion)) {
      return {
        ...config,
        ...(deploymentId ? { deploymentId } : {}),
        output: config.output === 'export' ? 'export' : 'standalone',
      };
    }
    if (config.output === 'export') {
      return { ...config, ...(deploymentId ? { deploymentId } : {}) };
    }

    const injectCacheHandler = config.cacheHandler === undefined;
    const injectCacheComponentHandlers = config.cacheHandlers === undefined;
    const images = config.images;
    const injectImageLoader =
      images !== undefined && images.unoptimized !== true && images.loader === 'default' && !images.loaderFile;

    return {
      ...config,
      ...(deploymentId ? { deploymentId } : {}),
      ...(injectCacheHandler ? { cacheHandler: CACHE_HANDLER_PATH() } : {}),
      ...(injectCacheComponentHandlers
        ? {
            cacheHandlers: {
              default: CACHE_COMPONENTS_HANDLER_PATH(),
              remote: CACHE_COMPONENTS_HANDLER_PATH(),
            },
          }
        : {}),
      ...(injectCacheHandler || injectCacheComponentHandlers ? { cacheMaxMemorySize: 0 } : {}),
      ...(injectImageLoader
        ? {
            images: {
              ...images,
              loader: 'custom',
              loaderFile: IMAGE_LOADER_PATH(),
            },
          }
        : {}),
    };
  },

  async onBuildComplete({ projectDir, repoRoot, distDir, config, nextVersion, buildId, routing, outputs }) {
    const metadataDirectory = path.join(projectDir, '.gigadrive');
    const portableOutputs = {
      pages: await Promise.all(outputs.pages.map((output) => serializeRouteOutput(repoRoot, output))),
      ...(outputs.middleware ? { middleware: await serializeRouteOutput(repoRoot, outputs.middleware) } : {}),
      appPages: await Promise.all(outputs.appPages.map((output) => serializeRouteOutput(repoRoot, output))),
      pagesApi: await Promise.all(outputs.pagesApi.map((output) => serializeRouteOutput(repoRoot, output))),
      appRoutes: await Promise.all(outputs.appRoutes.map((output) => serializeRouteOutput(repoRoot, output))),
      prerenders: await Promise.all(
        outputs.prerenders.map(async (output) => {
          const { bypassFor, ...prerenderConfig } = output.config;
          return {
            id: output.id,
            type: 'PRERENDER' as const,
            pathname: output.pathname,
            parentOutputId: output.parentOutputId,
            groupId: output.groupId,
            ...(output.pprChain ? { pprChain: output.pprChain } : {}),
            ...(output.parentFallbackMode !== undefined
              ? { parentFallbackMode: toJsonValue(output.parentFallbackMode) }
              : {}),
            ...(output.fallback
              ? {
                  fallback: {
                    ...(output.fallback.filePath
                      ? { filePath: await requireReadableFile(repoRoot, output.fallback.filePath) }
                      : {}),
                    ...(output.fallback.initialStatus !== undefined
                      ? { initialStatus: output.fallback.initialStatus }
                      : {}),
                    ...(output.fallback.initialHeaders ? { initialHeaders: output.fallback.initialHeaders } : {}),
                    ...(output.fallback.initialExpiration !== undefined
                      ? { initialExpiration: output.fallback.initialExpiration }
                      : {}),
                    ...(output.fallback.initialRevalidate !== undefined
                      ? { initialRevalidate: output.fallback.initialRevalidate }
                      : {}),
                    ...(output.fallback.postponedState !== undefined
                      ? { postponedState: output.fallback.postponedState }
                      : {}),
                  },
                }
              : {}),
            config: {
              ...prerenderConfig,
              ...(bypassFor ? { bypassFor: toJsonValue(bypassFor) as JsonValue[] } : {}),
            },
          };
        })
      ),
      staticFiles: await Promise.all(outputs.staticFiles.map((output) => serializeStaticOutput(repoRoot, output))),
    };
    const executableOutputs = [
      ...portableOutputs.pages,
      ...portableOutputs.pagesApi,
      ...portableOutputs.appPages,
      ...portableOutputs.appRoutes,
      ...(portableOutputs.middleware ? [portableOutputs.middleware] : []),
    ];
    const entrypointPlan = buildEntrypointPlan(executableOutputs);
    await writeEntrypointWrappers(projectDir, repoRoot, entrypointPlan.entrypoints);
    const images = normalizeImages(config);
    const manifest: GigadriveNextBuildManifestV2 = {
      version: 2,
      mode: config.output === 'export' ? 'export' : 'adapter-v2',
      distDir: toPortableRelativePath(projectDir, distDir),
      repoRootToProject: toPortableRelativePath(repoRoot, projectDir, true),
      nextVersion,
      buildId,
      config: {
        basePath: config.basePath,
        trailingSlash: config.trailingSlash,
        cacheComponents: config.cacheComponents,
        ...(config.i18n ? { i18n: toJsonValue(config.i18n) } : {}),
        ...(images ? { images } : {}),
      },
      routing: {
        beforeMiddleware: toJsonValue(routing.beforeMiddleware) as JsonValue[],
        beforeFiles: toJsonValue(routing.beforeFiles) as JsonValue[],
        afterFiles: toJsonValue(routing.afterFiles) as JsonValue[],
        dynamicRoutes: toJsonValue(routing.dynamicRoutes) as JsonValue[],
        onMatch: toJsonValue(routing.onMatch) as JsonValue[],
        fallback: toJsonValue(routing.fallback) as JsonValue[],
        shouldNormalizeNextData: routing.shouldNormalizeNextData,
        rsc: toJsonValue(routing.rsc),
      },
      outputs: portableOutputs,
      ...entrypointPlan,
    };

    await mkdir(metadataDirectory, { recursive: true });
    await writeFile(path.join(metadataDirectory, 'nextjs.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  },
};

export default gigadriveNextAdapter;

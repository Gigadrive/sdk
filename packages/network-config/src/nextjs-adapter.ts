import type { NextAdapter } from 'next';
import { access, mkdir, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedImagePolicy } from './image-policy';
import type {
  GigadriveNextBuildManifestV1,
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
const PPR_RUNTIME_PATH = () => runtimeModulePath('GIGADRIVE_NEXT_PPR_RUNTIME_PATH', 'nextjs-ppr-runtime.js');

const toJsonValue = (value: unknown): JsonValue => {
  const serialized = JSON.stringify(value);
  return serialized === undefined ? null : (JSON.parse(serialized) as JsonValue);
};

const supportsAdapterV2 = (nextVersion: string | undefined): boolean => {
  if (!nextVersion) return false;
  const [majorPart, minorPart] = nextVersion.split('.');
  const major = Number.parseInt(majorPart ?? '', 10);
  const minor = Number.parseInt(minorPart ?? '', 10);
  return Number.isFinite(major) && Number.isFinite(minor) && (major > 16 || (major === 16 && minor >= 2));
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

async function resolveReadablePath(repoRoot: string, filePath: string) {
  const absolutePath = path.resolve(path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath));
  const portablePath = toPortableRelativePath(repoRoot, absolutePath);
  await access(absolutePath);
  const resolvedPath = await realpath(absolutePath);
  toPortableRelativePath(repoRoot, resolvedPath);
  const fileStat = await stat(absolutePath);
  return { portablePath, fileStat };
}

async function requireReadableFile(repoRoot: string, filePath: string): Promise<string> {
  const { portablePath, fileStat } = await resolveReadablePath(repoRoot, filePath);
  if (!fileStat.isFile()) throw new Error(`Next.js adapter output is not a readable file: ${filePath}`);
  return portablePath;
}

async function requireReadableAsset(repoRoot: string, filePath: string): Promise<string> {
  const { portablePath, fileStat } = await resolveReadablePath(repoRoot, filePath);
  if (!fileStat.isFile() && !fileStat.isDirectory()) {
    throw new Error(`Next.js adapter asset is not a readable file or directory: ${filePath}`);
  }
  return portablePath;
}

async function serializeFileMap(repoRoot: string, files: Record<string, string>): Promise<Record<string, string>> {
  const entries = await Promise.all(
    Object.entries(files).map(async ([targetPath, sourcePath]) => [
      toPortableRelativePath(repoRoot, targetPath),
      await requireReadableAsset(repoRoot, sourcePath),
    ])
  );
  return Object.fromEntries(entries);
}

const serializeRuntimeConfigAssets = async (
  projectDir: string,
  repoRoot: string,
  config: BuildCompleteContext['config']
): Promise<Record<string, string>> => {
  const configuredPaths = new Set([
    config.cacheHandler,
    ...Object.values(config.cacheHandlers ?? {}),
    config.images.loaderFile,
    PPR_RUNTIME_PATH(),
  ]);
  const assets: Record<string, string> = {};
  for (const configuredPath of configuredPaths) {
    if (!configuredPath) continue;
    const absolutePath = path.resolve(
      path.isAbsolute(configuredPath) ? configuredPath : path.join(projectDir, configuredPath)
    );
    const portablePath = await requireReadableFile(repoRoot, absolutePath);
    assets[portablePath] = portablePath;
  }
  return assets;
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
      output.type === 'MIDDLEWARE' ? 'middleware-web' : 'route',
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
  entrypoints: GigadriveNextEntrypoint[],
  pprRuntimePath: string,
  middlewareOutputId?: string
): Promise<void> => {
  const wrapperDirectory = path.join(projectDir, '.gigadrive', 'nextjs', 'entrypoints');
  await mkdir(wrapperDirectory, { recursive: true });
  const portableWrapperDirectory = toPortableRelativePath(repoRoot, wrapperDirectory);
  const relativePprRuntimePath = path.posix.relative(portableWrapperDirectory, pprRuntimePath);
  const pprRuntimeSpecifier = relativePprRuntimePath.startsWith('.')
    ? relativePprRuntimePath
    : `./${relativePprRuntimePath}`;
  const relativeProjectDirectory = path.posix.relative(
    portableWrapperDirectory,
    toPortableRelativePath(repoRoot, projectDir)
  );
  const projectDirectorySpecifier = relativeProjectDirectory.startsWith('.')
    ? relativeProjectDirectory
    : `./${relativeProjectDirectory}`;

  await Promise.all(
    entrypoints.map(async (entrypoint) => {
      const wrapperPath = path.join(wrapperDirectory, `${entrypoint.id}.mjs`);
      const executablePath = path.join(repoRoot, entrypoint.edgeRuntime?.modulePath ?? entrypoint.filePath);
      const relativeImport = path.relative(wrapperDirectory, executablePath).replaceAll(path.sep, '/');
      const importSpecifier = relativeImport.startsWith('.') ? relativeImport : `./${relativeImport}`;
      const isMiddleware = middlewareOutputId !== undefined && entrypoint.outputIds.includes(middlewareOutputId);
      const webHandlerPrelude =
        entrypoint.runtime === 'edge' && entrypoint.edgeRuntime
          ? (() => {
              const edgeMarker = '/server/edge/';
              const markerIndex = entrypoint.edgeRuntime.modulePath.indexOf(edgeMarker);
              const distDirectory =
                markerIndex >= 0
                  ? entrypoint.edgeRuntime.modulePath.slice(0, markerIndex)
                  : path.dirname(entrypoint.edgeRuntime.modulePath);
              const edgeRuntimeAssets = Object.entries(entrypoint.assets)
                .filter(([, sourcePath]) => sourcePath.startsWith(`${distDirectory}/`) && sourcePath.endsWith('.js'))
                .sort(([, leftSource], [, rightSource]) => {
                  if (leftSource === entrypoint.edgeRuntime?.modulePath) return 1;
                  if (rightSource === entrypoint.edgeRuntime?.modulePath) return -1;
                  return leftSource.localeCompare(rightSource);
                });
              const imports = edgeRuntimeAssets
                .map(([targetPath, sourcePath]) => {
                  // Next includes the executable Edge module in `assets` under a
                  // deployment-relative target such as `server/edge/chunks/*`,
                  // while `modulePath` retains its canonical `.next/server/*`
                  // location. Function packaging installs the executable at the
                  // canonical path, so the wrapper must import it there as well.
                  const runtimeTargetPath =
                    sourcePath === entrypoint.edgeRuntime?.modulePath ? entrypoint.edgeRuntime.modulePath : targetPath;
                  const relativeAssetPath = path.posix.relative(portableWrapperDirectory, runtimeTargetPath);
                  const assetSpecifier = relativeAssetPath.startsWith('.')
                    ? relativeAssetPath
                    : `./${relativeAssetPath}`;
                  return `  await import(${JSON.stringify(assetSpecifier)});`;
                })
                .join('\n');
              return `import { AsyncLocalStorage } from "node:async_hooks";\n\nconst resolveHandler = async () => {\n  globalThis.self ??= globalThis;\n  globalThis.AsyncLocalStorage ??= AsyncLocalStorage;\n${imports}\n  const registry = globalThis._ENTRIES;\n  if (!registry) throw new Error('Next.js edge entry registry is unavailable');\n  const entry = await registry[${JSON.stringify(entrypoint.edgeRuntime.entryKey)}];\n  const handler = entry?.[${JSON.stringify(entrypoint.edgeRuntime.handlerExport)}];\n  if (typeof handler !== 'function') throw new Error('Next.js edge handler is unavailable');\n  return handler;\n};`;
            })()
          : `import { fileURLToPath } from "node:url";\n\nconst resolveHandler = async () => {\n  process.chdir(fileURLToPath(new URL(${JSON.stringify(projectDirectorySpecifier)}, import.meta.url)));\n  const nextEntrypoint = await import(${JSON.stringify(importSpecifier)});\n  const loadedEntrypoint = await Promise.resolve(nextEntrypoint.default ?? nextEntrypoint);\n  const handler = nextEntrypoint.handler ?? loadedEntrypoint?.handler ?? loadedEntrypoint?.default?.handler ?? loadedEntrypoint?.default ?? loadedEntrypoint;\n  if (typeof handler !== 'function') throw new Error('Next.js middleware handler is unavailable');\n  return handler;\n};`;
      const source =
        (entrypoint.runtime === 'edge' && entrypoint.edgeRuntime) || isMiddleware
          ? `import { persistPprCacheEntry } from ${JSON.stringify(pprRuntimeSpecifier)};\n${webHandlerPrelude}\n\nexport async function fetch(request) {\n  const pending = [];\n  const handler = await resolveHandler();\n  const url = new URL(request.url);\n  const response = await handler(request, {\n    signal: request.signal,\n    waitUntil(promise) { pending.push(Promise.resolve(promise)); },\n    requestMeta: { hostname: url.hostname, invocationTarget: request.headers.get('x-gigadrive-next-invocation-target') ?? url.pathname, routeMatches: Object.fromEntries(new URLSearchParams(request.headers.get('x-now-route-matches') ?? '')), relativeProjectDir: ${JSON.stringify(
              entrypoint.runtime === 'nodejs' ? '.' : toPortableRelativePath(repoRoot, projectDir, true)
            )}, onCacheEntryV2(cacheEntry, meta) { pending.push(persistPprCacheEntry(request.headers.get('x-gigadrive-next-cache-key') ?? meta.url ?? request.headers.get('x-matched-path') ?? url.pathname, cacheEntry)); return false; } },\n  });\n  if (!response.body) { await Promise.allSettled(pending); return response; }\n  const reader = response.body.getReader();\n  const body = new ReadableStream({\n    async pull(controller) {\n      const result = await reader.read();\n      if (result.done) { await Promise.allSettled(pending); controller.close(); return; }\n      controller.enqueue(result.value);\n    },\n    async cancel(reason) { try { await reader.cancel(reason); } finally { await Promise.allSettled(pending); } },\n  });\n  return new Response(body, response);\n}\n`
          : `import "next/dist/build/adapter/setup-node-env.external.js";\nimport { fileURLToPath } from "node:url";\nimport { persistPprCacheEntry, revalidateNextPath } from ${JSON.stringify(pprRuntimeSpecifier)};\n\nconst resolveHandler = async () => {\n  process.chdir(fileURLToPath(new URL(${JSON.stringify(projectDirectorySpecifier)}, import.meta.url)));\n  const nextEntrypoint = await import(${JSON.stringify(importSpecifier)});\n  const loadedEntrypoint = await Promise.resolve(nextEntrypoint.default ?? nextEntrypoint);\n  const handler = nextEntrypoint.handler ?? loadedEntrypoint?.handler ?? loadedEntrypoint?.default?.handler ?? loadedEntrypoint?.default ?? loadedEntrypoint;\n  if (typeof handler !== 'function') throw new Error('Next.js Node handler is unavailable');\n  return handler;\n};\n\nexport default async function handler(req, res) {\n  const pending = [];\n  const nextHandler = await resolveHandler();\n  const hostname = Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host;\n  await nextHandler(req, res, {\n    waitUntil(promise) { pending.push(Promise.resolve(promise)); },\n    requestMeta: { hostname, invocationTarget: req.headers['x-gigadrive-next-invocation-target'] ?? req.url, routeMatches: Object.fromEntries(new URLSearchParams(req.headers['x-now-route-matches'] ?? '')), relativeProjectDir: ${JSON.stringify(
              '.'
            )}, revalidate(input) { return revalidateNextPath({ ...input, hostname }); }, onCacheEntryV2(cacheEntry, meta) { const cacheKey = req.headers['x-gigadrive-next-cache-key']; const matchedPath = req.headers['x-matched-path']; pending.push(persistPprCacheEntry((Array.isArray(cacheKey) ? cacheKey[0] : cacheKey) ?? meta.url ?? (Array.isArray(matchedPath) ? matchedPath[0] : matchedPath) ?? req.url ?? '/', cacheEntry)); return false; } },\n  });\n  await Promise.allSettled(pending);\n}\n`;
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
 * Next 16.2 and newer emit a portable, versioned runtime plan. Older releases retain
 * the standalone-server behavior because their experimental adapter context does not
 * expose the routing and runtime metadata required by the v2 contract.
 */
const gigadriveNextAdapter: NextAdapter = {
  name: 'Gigadrive Network',

  modifyConfig(config, { phase, nextVersion }) {
    if (phase !== PRODUCTION_BUILD_PHASE) return config;

    const deploymentId = config.deploymentId ?? process.env.GIGADRIVE_DEPLOYMENT_ID;
    if (!supportsAdapterV2(nextVersion)) {
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
    if (!supportsAdapterV2(nextVersion)) {
      const manifest: GigadriveNextBuildManifestV1 = {
        version: 1,
        output: config.output === 'export' ? 'export' : 'standalone',
        distDir: toPortableRelativePath(projectDir, distDir),
        repoRootToProject: toPortableRelativePath(repoRoot, projectDir, true),
        nextVersion,
        buildId,
      };
      await mkdir(metadataDirectory, { recursive: true });
      await writeFile(path.join(metadataDirectory, 'nextjs.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
      return;
    }
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
    const runtimeConfigAssets = await serializeRuntimeConfigAssets(projectDir, repoRoot, config);
    for (const entrypoint of entrypointPlan.entrypoints) Object.assign(entrypoint.assets, runtimeConfigAssets);
    const pprRuntimePath = await requireReadableFile(repoRoot, PPR_RUNTIME_PATH());
    await writeEntrypointWrappers(
      projectDir,
      repoRoot,
      entrypointPlan.entrypoints,
      pprRuntimePath,
      portableOutputs.middleware?.id
    );
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

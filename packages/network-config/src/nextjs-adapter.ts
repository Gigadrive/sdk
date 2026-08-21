import { Schema } from 'effect';
import type { NextAdapter } from 'next';
import { access, mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StaticAssetHeaders, StaticAssetManifestEntry, StaticAssetManifestV1 } from './asset-manifest';
import type { NormalizedImagePolicy } from './image-policy';
import { decodeJson, decodeUnknown, HttpHeadersSchema } from './manifest-schema';
import { MAXIMUM_ENTRY_PAGE_PATHS } from './nextjs-constants';
import type {
  GigadriveNextBuildManifestV1,
  GigadriveNextBuildManifestV2Export,
  GigadriveNextBuildManifestV2Standalone,
  GigadriveNextPrerenderManifestV1,
  GigadriveNextPrerenderOutput,
  GigadriveNextServerDescriptor,
  GigadriveNextStaticAssetPrefix,
  JsonValue,
} from './nextjs-manifest';

type BuildCompleteContext = Parameters<NonNullable<NextAdapter['onBuildComplete']>>[0];
type NextRouteOutput =
  | BuildCompleteContext['outputs']['pages'][number]
  | BuildCompleteContext['outputs']['pagesApi'][number]
  | BuildCompleteContext['outputs']['appPages'][number]
  | BuildCompleteContext['outputs']['appRoutes'][number]
  | NonNullable<BuildCompleteContext['outputs']['middleware']>;
type NextPrerenderOutput = BuildCompleteContext['outputs']['prerenders'][number];
type NextStaticFileOutput = BuildCompleteContext['outputs']['staticFiles'][number];

const PRODUCTION_BUILD_PHASE = 'phase-production-build';
const NEXT_ASSET_MANIFEST_PATH = '.gigadrive/assets/nextjs.json';
const NEXT_PRERENDER_MANIFEST_PATH = '.gigadrive/nextjs-prerenders.json';
const HTML_CONTENT_TYPE = 'text/html; charset=utf-8';
const DEFAULT_RSC_CONTENT_TYPE = 'text/x-component';
const INTERNAL_STATIC_RESPONSE_HEADERS = new Set(['x-next-cache-tags', 'x-nextjs-prerender']);
const NextStaticFileMetaSchema = Schema.Struct({
  status: Schema.optional(Schema.Int.pipe(Schema.between(100, 599))),
  headers: Schema.mutable(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});
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

/**
 * Next 16.2 introduced the adapter hooks (`modifyConfig` + `onBuildComplete`) and
 * the `cacheHandler`/`cacheHandlers`/`cacheComponents` config fields we inject.
 * Earlier releases keep the legacy standalone-only behavior with no injection.
 */
const supportsManagedRuntime = (nextVersion: string | undefined): boolean => {
  if (!nextVersion) return false;
  const [majorPart, minorPart] = nextVersion.split('.');
  const major = Number.parseInt(majorPart ?? '', 10);
  const minor = Number.parseInt(minorPart ?? '', 10);
  return Number.isFinite(major) && Number.isFinite(minor) && (major > 16 || (major === 16 && minor >= 2));
};

/**
 * Highest Next major validated to allow `output: 'standalone'` together with an
 * adapter. Next's own build source warns the combination "might not be allowed"
 * in a future release. We always emit `output: 'standalone'` on the managed path
 * (there is no per-route fallback to degrade to), so if a future major forbids
 * it the build fails loudly at `next build` rather than silently misdeploying.
 * The network canary drift test tracks releases past this bound.
 */
const MANAGED_STANDALONE_VALIDATED_MAX_MAJOR = 16;

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

async function resolveReadablePath(repoRoot: string, filePath: string, resolvedRoot?: string) {
  const absolutePath = path.resolve(path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath));
  const portablePath = toPortableRelativePath(repoRoot, absolutePath);
  await access(absolutePath);
  // Validate the symlink-resolved location as well; the call throws when the
  // real path escapes the repository root.
  const resolvedPath = await realpath(absolutePath);
  void toPortableRelativePath(resolvedRoot ?? (await realpath(repoRoot)), resolvedPath);
  const fileStat = await stat(absolutePath);
  return { portablePath, fileStat };
}

async function requireReadableFile(repoRoot: string, filePath: string, resolvedRoot?: string): Promise<string> {
  const { portablePath, fileStat } = await resolveReadablePath(repoRoot, filePath, resolvedRoot);
  if (!fileStat.isFile()) throw new Error(`Next.js adapter output is not a readable file: ${filePath}`);
  return portablePath;
}

async function mapInBatches<Input, Output>(
  values: Input[],
  mapper: (value: Input) => Promise<Output>,
  batchSize = 64
): Promise<Output[]> {
  const results: Output[] = [];
  for (let index = 0; index < values.length; index += batchSize) {
    results.push(...(await Promise.all(values.slice(index, index + batchSize).map((value) => mapper(value)))));
  }
  return results;
}

const isInsideDirectory = (directory: string, filePath: string): boolean => {
  const relativePath = path.relative(path.resolve(directory), path.resolve(filePath));
  return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
};

const isDynamicRoutePathname = (pathname: string): boolean => pathname.includes('[');

// Next reports the Pages Router root as `<basePath>/index`, while its public URL
// is the base path itself (or `/` when no base path is configured).
const normalizeStaticFilePathname = (pathname: string, basePath: string): string =>
  pathname === `${basePath}/index` ? basePath || '/' : pathname;

const getStaticStatus = (pathname: string, basePath: string, locales: readonly string[]): number | undefined => {
  const routePathname = basePath && pathname.startsWith(`${basePath}/`) ? pathname.slice(basePath.length) : pathname;
  const segments = routePathname.split('/').filter(Boolean);
  const [firstSegment, secondSegment] = segments;
  const statusPage =
    segments.length === 1
      ? firstSegment
      : segments.length === 2 && firstSegment && locales.includes(firstSegment)
        ? secondSegment
        : undefined;
  return statusPage === '404' ? 404 : statusPage === '500' ? 500 : undefined;
};

const hasContentType = (headers: StaticAssetHeaders): boolean =>
  Object.keys(headers).some((name) => name.toLowerCase() === 'content-type');

const getPublicStaticResponseHeaders = (headers: Record<string, unknown>): StaticAssetHeaders | undefined => {
  const publicHeaders = Object.fromEntries(
    Object.entries(headers).filter(([name]) => !INTERNAL_STATIC_RESPONSE_HEADERS.has(name.toLowerCase()))
  );
  return decodeUnknown(HttpHeadersSchema, publicHeaders);
};

async function getStaticFileResponseMetadata(
  projectDir: string,
  resolvedProjectDir: string,
  output: NextStaticFileOutput,
  rscContentType: string,
  basePath: string,
  locales: readonly string[]
): Promise<Pick<StaticAssetManifestEntry, 'status' | 'headers'> | undefined> {
  if (output.filePath.endsWith('.body')) {
    const metaPath = `${output.filePath.slice(0, -'.body'.length)}.meta`;
    await requireReadableFile(projectDir, metaPath, resolvedProjectDir);
    const meta = decodeJson(NextStaticFileMetaSchema, await readFile(metaPath, 'utf8'));
    const headers = meta ? getPublicStaticResponseHeaders(meta.headers) : undefined;
    if (!meta || !headers || !hasContentType(headers)) return undefined;
    return {
      ...(meta.status !== undefined ? { status: meta.status } : {}),
      headers,
    };
  }
  if (output.filePath.endsWith('.html')) {
    const status = getStaticStatus(output.pathname, basePath, locales);
    return {
      ...(status !== undefined ? { status } : {}),
      headers: { 'content-type': HTML_CONTENT_TYPE },
    };
  }
  if (output.pathname.endsWith('.rsc')) return { headers: { 'content-type': rscContentType } };
  return {};
}

const serializeStaticFileAsset = async (
  projectDir: string,
  resolvedProjectDir: string,
  basePath: string,
  rscContentType: string,
  locales: readonly string[],
  output: NextStaticFileOutput
): Promise<StaticAssetManifestEntry | undefined> => {
  const [source, responseMetadata] = await Promise.all([
    requireReadableFile(projectDir, output.filePath, resolvedProjectDir),
    getStaticFileResponseMetadata(projectDir, resolvedProjectDir, output, rscContentType, basePath, locales),
  ]);
  if (!responseMetadata) return undefined;
  return {
    source,
    path: normalizeStaticFilePathname(output.pathname, basePath),
    ...responseMetadata,
    ...(output.immutableHash ? { immutable: true } : {}),
  };
};

const serializePrerenderAsset = (
  projectDir: string,
  repoRoot: string,
  distDir: string,
  output: GigadriveNextPrerenderOutput
): StaticAssetManifestEntry | undefined => {
  const { fallback } = output;
  // `false` disables scheduled ISR. Per-route bypass conditions still require
  // runtime; Pages Router prerenders also stay server-backed because they may
  // be updated through on-demand ISR even without a time-based revalidation.
  const hasNoTimeBasedRevalidation = fallback?.initialRevalidate === false;
  if (
    !fallback?.filePath ||
    !hasNoTimeBasedRevalidation ||
    fallback.postponedState !== undefined ||
    output.config.bypassFor !== undefined ||
    isInsideDirectory(path.join(distDir, 'server', 'pages'), path.resolve(repoRoot, fallback.filePath)) ||
    isDynamicRoutePathname(output.pathname)
  ) {
    return undefined;
  }
  const headers = fallback.initialHeaders ? getPublicStaticResponseHeaders(fallback.initialHeaders) : undefined;
  return {
    source: toPortableRelativePath(projectDir, path.join(repoRoot, fallback.filePath)),
    path: output.pathname,
    ...(fallback.initialStatus !== undefined ? { status: fallback.initialStatus } : {}),
    ...(headers ? { headers } : {}),
  };
};

async function serializeAssetManifest(
  projectDir: string,
  resolvedProjectDir: string,
  repoRoot: string,
  distDir: string,
  basePath: string,
  rscContentType: string,
  locales: readonly string[],
  staticFiles: NextStaticFileOutput[],
  prerenders: GigadriveNextPrerenderOutput[]
): Promise<StaticAssetManifestV1> {
  const staticDirectory = path.join(distDir, 'static');
  const staticEntries = await mapInBatches(
    staticFiles.filter(
      // The complete immutable subtree is already represented by a prefix.
      (output) => !isInsideDirectory(staticDirectory, output.filePath) && !isDynamicRoutePathname(output.pathname)
    ),
    (output) => serializeStaticFileAsset(projectDir, resolvedProjectDir, basePath, rscContentType, locales, output)
  );
  const entries = [
    ...staticEntries,
    ...prerenders.map((output) => serializePrerenderAsset(projectDir, repoRoot, distDir, output)),
  ];
  const assetsByPath = new Map<string, StaticAssetManifestEntry>();
  for (const entry of entries) {
    if (!entry) continue;
    if (assetsByPath.has(entry.path)) throw new Error(`Duplicate Next.js static asset path: ${entry.path}`);
    assetsByPath.set(entry.path, entry);
  }
  return { version: 1, assets: [...assetsByPath.values()] };
}

const getEntryPagePaths = (prerenders: GigadriveNextPrerenderOutput[]): string[] =>
  [
    ...new Set(
      prerenders
        .filter((output) => output.fallback?.postponedState === undefined)
        .map((output) => output.pathname)
        .filter((pathname) => pathname.startsWith('/') && !isDynamicRoutePathname(pathname))
    ),
  ]
    .sort((left, right) => left.split('/').length - right.split('/').length || left.localeCompare(right))
    .slice(0, MAXIMUM_ENTRY_PAGE_PATHS);

const serializePrerenderOutput = async (
  repoRoot: string,
  resolvedRepoRoot: string,
  output: NextPrerenderOutput
): Promise<GigadriveNextPrerenderOutput> => {
  const { bypassFor, ...prerenderConfig } = output.config;
  return {
    id: output.id,
    type: 'PRERENDER',
    pathname: output.pathname,
    parentOutputId: output.parentOutputId,
    groupId: output.groupId,
    ...(output.pprChain ? { pprChain: output.pprChain } : {}),
    ...(output.parentFallbackMode !== undefined ? { parentFallbackMode: toJsonValue(output.parentFallbackMode) } : {}),
    ...(output.fallback
      ? {
          fallback: {
            ...(output.fallback.filePath
              ? { filePath: await requireReadableFile(repoRoot, output.fallback.filePath, resolvedRepoRoot) }
              : {}),
            ...(output.fallback.initialStatus !== undefined ? { initialStatus: output.fallback.initialStatus } : {}),
            ...(output.fallback.initialHeaders ? { initialHeaders: output.fallback.initialHeaders } : {}),
            ...(output.fallback.initialExpiration !== undefined
              ? { initialExpiration: output.fallback.initialExpiration }
              : {}),
            ...(output.fallback.initialRevalidate !== undefined
              ? { initialRevalidate: output.fallback.initialRevalidate }
              : {}),
            ...(output.fallback.postponedState !== undefined ? { postponedState: output.fallback.postponedState } : {}),
          },
        }
      : {}),
    config: {
      ...prerenderConfig,
      ...(bypassFor ? { bypassFor: toJsonValue(bypassFor) as JsonValue[] } : {}),
    },
  };
};

/**
 * Collapses per-route runtime config onto the one standalone server. `maxDuration`
 * becomes the max across routes (one function honors one limit); `env` is the union
 * of every route's declared env (the single server runs them all in-process).
 */
const aggregateServerDescriptor = (outputs: NextRouteOutput[]): GigadriveNextServerDescriptor => {
  let maxDuration: number | undefined;
  const env: Record<string, string> = {};
  for (const output of outputs) {
    if (output.config.maxDuration !== undefined) {
      maxDuration = Math.max(maxDuration ?? 0, output.config.maxDuration);
    }
    if (output.config.env) Object.assign(env, output.config.env);
  }
  return {
    ...(maxDuration !== undefined ? { maxDuration } : {}),
    ...(Object.keys(env).length > 0 ? { env } : {}),
  };
};

type CollectBuildTracesModule = {
  collectBuildTraces: (options: {
    dir: string;
    config: BuildCompleteContext['config'];
    distDir: string;
    edgeRuntimeRoutes: Record<string, never>;
    staticPages: string[];
    outputFileTracingRoot: string;
  }) => Promise<void>;
};

/**
 * Ignore globs that Turbopack's native server tracer applies on top of the
 * shared `collectBuildTraces` ignore list (see `ignores()` in Next's
 * `crates/next-api/src/next_server_nft.rs`). The JavaScript
 * `collectBuildTraces` fallback only carries the webpack-era ignores, so
 * tracing Next's server entries with it follows dev-only require edges —
 * `router-server` → `setup-dev-bundler` → hot reloaders → the application's
 * build toolchain (webpack, terser, esbuild, swc, babel plugins) — that
 * Turbopack severs natively, roughly quadrupling the standalone output.
 *
 * Passing these through `outputFileTracingExcludes['next-server']` reuses
 * `collectBuildTraces`' own extension point for the shared ignores, so they
 * apply during trace traversal exactly like Turbopack's graph-level ignores.
 * Only Next-internal dev/build-only modules are listed — never application
 * packages — so application dependencies are excluded solely when their every
 * require path runs through one of these modules, matching the native trace.
 * If a future Next release moves one of these files the glob simply stops
 * matching and the trace grows back; nothing breaks at runtime.
 */
const TURBOPACK_SERVER_TRACE_IGNORES = [
  // client components with a NODE_ENV guard the tracer cannot evaluate
  '**/next/dist/next-devtools/userspace/use-app-dev-rendering-indicator.js',
  '**/next/dist/client/dev/hot-reloader/app/hot-reloader-app.js',
  // server/lib/router-server.js requires this statically but only uses it in dev
  '**/next/dist/server/lib/router-utils/setup-dev-bundler.js',
  // server/next.js requires this statically but only uses it in dev
  '**/next/dist/server/dev/next-dev-server.js',
  // build-time-only browser support data pulled in via next/dist/compiled/babel*
  '**/next/dist/compiled/browserslist/**',
  '**/next/dist/compiled/jest-worker/**/*',
  '**/node_modules/react{,-dom,-server-dom-turbopack}/**/*.development.js',
];

/**
 * Next 16.3 stopped emitting the aggregated `next-server.js.nft.json` /
 * `next-minimal-server.js.nft.json` traces from Turbopack builds whenever an
 * adapter is configured, yet `next build` still runs the `output: 'standalone'`
 * writer after `onBuildComplete` — and that writer reads exactly this file, so
 * the build dies with ENOENT. Next 16.2 and all webpack builds still emit the
 * file, making this a no-op there. When the file is missing, regenerate both
 * aggregate traces with Next's own `collectBuildTraces` (the module the webpack
 * pipeline runs); without `buildTraceContext` it only writes the two aggregate
 * trace files and leaves Turbopack's per-entry traces untouched. The
 * regeneration also merges `TURBOPACK_SERVER_TRACE_IGNORES` into the config's
 * `outputFileTracingExcludes` so the fallback prunes the same dev-only require
 * edges as Turbopack's native tracer instead of dragging the application's
 * build toolchain into the standalone output.
 */
async function ensureStandaloneServerTraces(
  projectDir: string,
  repoRoot: string,
  distDir: string,
  config: BuildCompleteContext['config']
): Promise<void> {
  const aggregateTracePath = path.join(distDir, 'next-server.js.nft.json');
  try {
    await access(aggregateTracePath);
    return;
  } catch {
    // Missing — Next will crash in its standalone writer unless we regenerate it.
  }
  let collectBuildTracesModule: CollectBuildTracesModule;
  try {
    const projectRequire = createRequire(path.join(projectDir, 'package.json'));
    collectBuildTracesModule = projectRequire('next/dist/build/collect-build-traces') as CollectBuildTracesModule;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Next.js did not emit ${aggregateTracePath} and the Gigadrive adapter could not load ` +
        `next/dist/build/collect-build-traces from the project to regenerate it: ${message}`
    );
  }
  const { outputFileTracingExcludes = {} } = config as {
    outputFileTracingExcludes?: Record<string, string[]>;
  };
  const tracingConfig = {
    ...config,
    outputFileTracingExcludes: {
      ...outputFileTracingExcludes,
      'next-server': [...(outputFileTracingExcludes['next-server'] ?? []), ...TURBOPACK_SERVER_TRACE_IGNORES],
    },
  };
  try {
    await collectBuildTracesModule.collectBuildTraces({
      dir: projectDir,
      config: tracingConfig,
      distDir,
      edgeRuntimeRoutes: {},
      staticPages: [],
      outputFileTracingRoot: (config as { outputFileTracingRoot?: string }).outputFileTracingRoot ?? repoRoot,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Regenerating the Next.js standalone server traces (${aggregateTracePath}) failed: ${message}`);
  }
}

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
 * Next 16.2 and newer run the entire deployment as a single `output: 'standalone'`
 * server (one function per deployment) while the injected cache handlers, image
 * loader, and this hook's `onBuildComplete` metadata keep ISR, PPR, `use cache`,
 * and image optimization working through the platform's durable runtime-cache and
 * edge image services. Older releases retain the legacy standalone behavior without
 * the managed-runtime injections.
 */
const gigadriveNextAdapter: NextAdapter = {
  name: 'Gigadrive Network',

  modifyConfig(config, { phase, nextVersion }) {
    if (phase !== PRODUCTION_BUILD_PHASE) return config;

    const deploymentId = config.deploymentId ?? process.env.GIGADRIVE_DEPLOYMENT_ID;
    if (!supportsManagedRuntime(nextVersion)) {
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
      // Run the whole deployment as one standalone Next server rather than a
      // serverless function per route. `onBuildComplete` still fires under
      // standalone (Next >= 16.2), and the standalone server natively honors the
      // injected cache handlers and resumes PPR from its incremental cache, so
      // ISR/PPR/`use cache` stay durable via the remote runtime-cache service.
      // Validated on Next 16.2.x (see MANAGED_STANDALONE_VALIDATED_MAX_MAJOR);
      // a future major that forbids adapter + standalone fails loudly at build.
      output: 'standalone',
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
    await mkdir(metadataDirectory, { recursive: true });
    const manifestPath = path.join(metadataDirectory, 'nextjs.json');
    const writeManifest = (manifest: unknown) =>
      writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    if (!supportsManagedRuntime(nextVersion)) {
      const manifest: GigadriveNextBuildManifestV1 = {
        version: 1,
        output: config.output === 'export' ? 'export' : 'standalone',
        distDir: toPortableRelativePath(projectDir, distDir),
        repoRootToProject: toPortableRelativePath(repoRoot, projectDir, true),
        nextVersion,
        buildId,
      };
      await writeManifest(manifest);
      return;
    }

    const portableDistDir = toPortableRelativePath(projectDir, distDir);
    const repoRootToProject = toPortableRelativePath(repoRoot, projectDir, true);

    if (config.output === 'export') {
      const manifest: GigadriveNextBuildManifestV2Export = {
        version: 2,
        mode: 'export',
        distDir: portableDistDir,
        repoRootToProject,
        nextVersion,
        buildId,
      };
      await writeManifest(manifest);
      return;
    }

    if (config.output === 'standalone') {
      await ensureStandaloneServerTraces(projectDir, repoRoot, distDir, config);
    }

    const [resolvedRepoRoot, resolvedProjectDir] = await Promise.all([realpath(repoRoot), realpath(projectDir)]);
    const prerenders = await mapInBatches(outputs.prerenders, (output) =>
      serializePrerenderOutput(repoRoot, resolvedRepoRoot, output)
    );
    const assetManifest = await serializeAssetManifest(
      projectDir,
      resolvedProjectDir,
      repoRoot,
      distDir,
      config.basePath,
      routing.rsc.contentTypeHeader ?? DEFAULT_RSC_CONTENT_TYPE,
      config.i18n?.locales ?? [],
      outputs.staticFiles,
      prerenders
    );
    const prerenderManifest: GigadriveNextPrerenderManifestV1 = { version: 1, prerenders };
    await mkdir(path.join(metadataDirectory, 'assets'), { recursive: true });
    await Promise.all([
      writeFile(path.join(projectDir, NEXT_ASSET_MANIFEST_PATH), `${JSON.stringify(assetManifest)}\n`, 'utf8'),
      writeFile(path.join(projectDir, NEXT_PRERENDER_MANIFEST_PATH), `${JSON.stringify(prerenderManifest)}\n`, 'utf8'),
    ]);
    const server = aggregateServerDescriptor([
      ...outputs.pages,
      ...outputs.pagesApi,
      ...outputs.appPages,
      ...outputs.appRoutes,
      ...(outputs.middleware ? [outputs.middleware] : []),
    ]);
    const images = normalizeImages(config);
    // `.next/static` is thousands of content-hashed, immutable chunks. Register
    // the whole subtree as one edge-served prefix instead of enumerating files.
    const staticAssets: GigadriveNextStaticAssetPrefix[] = [
      { sourceDir: `${portableDistDir}/static`, urlPrefix: '_next/static', immutable: true },
    ];

    const manifest: GigadriveNextBuildManifestV2Standalone = {
      version: 2,
      mode: 'standalone-v2',
      distDir: portableDistDir,
      repoRootToProject,
      nextVersion,
      buildId,
      server,
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
      outputs: {
        prerenders: [],
        prerenderManifest: NEXT_PRERENDER_MANIFEST_PATH,
        assetManifest: NEXT_ASSET_MANIFEST_PATH,
        entryPagePaths: getEntryPagePaths(prerenders),
        staticAssets,
      },
    };
    await writeManifest(manifest);
  },
};

export { MANAGED_STANDALONE_VALIDATED_MAX_MAJOR };
export default gigadriveNextAdapter;

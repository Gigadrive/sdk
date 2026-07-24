import type { NextAdapter } from 'next';
import { access, mkdir, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedImagePolicy } from './image-policy';
import type {
  GigadriveNextBuildManifestV1,
  GigadriveNextBuildManifestV2Export,
  GigadriveNextBuildManifestV2Standalone,
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

async function resolveReadablePath(repoRoot: string, filePath: string) {
  const absolutePath = path.resolve(path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath));
  const portablePath = toPortableRelativePath(repoRoot, absolutePath);
  await access(absolutePath);
  // Validate the symlink-resolved location as well; the call throws when the
  // real path escapes the repository root.
  const resolvedPath = await realpath(absolutePath);
  void toPortableRelativePath(repoRoot, resolvedPath);
  const fileStat = await stat(absolutePath);
  return { portablePath, fileStat };
}

async function requireReadableFile(repoRoot: string, filePath: string): Promise<string> {
  const { portablePath, fileStat } = await resolveReadablePath(repoRoot, filePath);
  if (!fileStat.isFile()) throw new Error(`Next.js adapter output is not a readable file: ${filePath}`);
  return portablePath;
}

const serializePrerenderOutput = async (
  repoRoot: string,
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
              ? { filePath: await requireReadableFile(repoRoot, output.fallback.filePath) }
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

    const prerenders = await Promise.all(
      outputs.prerenders.map((output) => serializePrerenderOutput(repoRoot, output))
    );
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
      outputs: { prerenders, staticAssets },
    };
    await writeManifest(manifest);
  },
};

export { MANAGED_STANDALONE_VALIDATED_MAX_MAJOR };
export default gigadriveNextAdapter;

import type { NormalizedImagePolicy } from './image-policy';

/** JSON values accepted in the portable Next.js adapter manifest. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type GigadriveNextRuntime = 'nodejs' | 'edge';

export interface GigadriveNextEdgeRuntime {
  modulePath: string;
  entryKey: string;
  handlerExport: string;
}

export interface GigadriveNextEntrypoint {
  id: string;
  runtime: GigadriveNextRuntime;
  filePath: string;
  outputIds: string[];
  assets: Record<string, string>;
  wasmAssets?: Record<string, string>;
  edgeRuntime?: GigadriveNextEdgeRuntime;
  config: {
    maxDuration?: number;
    preferredRegion?: string | string[];
    env?: Record<string, string>;
  };
}

export interface GigadriveNextRouteOutput {
  id: string;
  type: 'PAGES' | 'PAGES_API' | 'APP_PAGE' | 'APP_ROUTE' | 'MIDDLEWARE';
  filePath: string;
  pathname: string;
  sourcePage: string;
  runtime: GigadriveNextRuntime;
  assets: Record<string, string>;
  wasmAssets?: Record<string, string>;
  edgeRuntime?: GigadriveNextEdgeRuntime;
  config: {
    maxDuration?: number;
    preferredRegion?: string | string[];
    env?: Record<string, string>;
    matchers?: Array<{
      source: string;
      sourceRegex: string;
      has?: JsonValue[];
      missing?: JsonValue[];
    }>;
  };
}

export interface GigadriveNextPrerenderOutput {
  id: string;
  type: 'PRERENDER';
  pathname: string;
  parentOutputId: string;
  groupId: number;
  pprChain?: { headers: Record<string, string> };
  parentFallbackMode?: JsonValue;
  fallback?: {
    filePath?: string;
    initialStatus?: number;
    initialHeaders?: Record<string, string | string[]>;
    initialExpiration?: number;
    initialRevalidate?: number | false;
    postponedState?: string;
  };
  config: {
    allowQuery?: string[];
    allowHeader?: string[];
    bypassFor?: JsonValue[];
    renderingMode?: string;
    partialFallback?: boolean;
    bypassToken?: string;
  };
}

export interface GigadriveNextStaticOutput {
  id: string;
  type: 'STATIC_FILE';
  filePath: string;
  pathname: string;
  immutableHash?: string;
}

export interface GigadriveNextBuildManifestV1 {
  version: 1;
  output: 'standalone' | 'export';
  distDir: string;
  repoRootToProject: string;
  nextVersion: string;
  buildId: string;
}

/** Portable build/runtime plan emitted by the Next.js 16 deployment adapter. */
export interface GigadriveNextBuildManifestV2 {
  version: 2;
  mode: 'adapter-v2' | 'export';
  distDir: string;
  repoRootToProject: string;
  nextVersion: string;
  buildId: string;
  config: {
    basePath: string;
    trailingSlash: boolean;
    cacheComponents: boolean;
    i18n?: JsonValue;
    images?: NormalizedImagePolicy;
  };
  routing: {
    beforeMiddleware: JsonValue[];
    beforeFiles: JsonValue[];
    afterFiles: JsonValue[];
    dynamicRoutes: JsonValue[];
    onMatch: JsonValue[];
    fallback: JsonValue[];
    shouldNormalizeNextData: boolean;
    rsc: JsonValue;
  };
  outputs: {
    pages: GigadriveNextRouteOutput[];
    middleware?: GigadriveNextRouteOutput;
    appPages: GigadriveNextRouteOutput[];
    pagesApi: GigadriveNextRouteOutput[];
    appRoutes: GigadriveNextRouteOutput[];
    prerenders: GigadriveNextPrerenderOutput[];
    staticFiles: GigadriveNextStaticOutput[];
  };
  entrypoints: GigadriveNextEntrypoint[];
  outputEntrypoints: Record<string, string>;
}

export type GigadriveNextBuildManifest = GigadriveNextBuildManifestV1 | GigadriveNextBuildManifestV2;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isPortableRelativePath = (value: unknown, allowCurrentDirectory = false): value is string => {
  if (typeof value !== 'string') return false;
  const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
  return (
    (allowCurrentDirectory || (normalized !== '' && normalized !== '.')) &&
    !normalized.startsWith('/') &&
    !/^[A-Za-z]:/.test(normalized) &&
    !normalized.includes(':') &&
    !normalized.split('/').some((segment) => segment === '..')
  );
};

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((item) => typeof item === 'string');

const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
};

const isRouteOutput = (value: unknown): value is GigadriveNextRouteOutput =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  ['PAGES', 'PAGES_API', 'APP_PAGE', 'APP_ROUTE', 'MIDDLEWARE'].includes(String(value.type)) &&
  isPortableRelativePath(value.filePath) &&
  typeof value.pathname === 'string' &&
  typeof value.sourcePage === 'string' &&
  (value.runtime === 'nodejs' || value.runtime === 'edge') &&
  isStringRecord(value.assets) &&
  isRecord(value.config);

const isPrerenderOutput = (value: unknown): value is GigadriveNextPrerenderOutput =>
  isRecord(value) &&
  value.type === 'PRERENDER' &&
  typeof value.id === 'string' &&
  typeof value.pathname === 'string' &&
  typeof value.parentOutputId === 'string' &&
  typeof value.groupId === 'number' &&
  isRecord(value.config) &&
  (value.fallback === undefined ||
    (isRecord(value.fallback) &&
      (value.fallback.filePath === undefined || isPortableRelativePath(value.fallback.filePath))));

const isStaticOutput = (value: unknown): value is GigadriveNextStaticOutput =>
  isRecord(value) &&
  value.type === 'STATIC_FILE' &&
  typeof value.id === 'string' &&
  typeof value.pathname === 'string' &&
  isPortableRelativePath(value.filePath);

const isEntrypoint = (value: unknown): value is GigadriveNextEntrypoint =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  (value.runtime === 'nodejs' || value.runtime === 'edge') &&
  isPortableRelativePath(value.filePath) &&
  Array.isArray(value.outputIds) &&
  value.outputIds.every((item) => typeof item === 'string') &&
  isStringRecord(value.assets) &&
  isRecord(value.config);

const isImagePolicy = (value: unknown): value is NormalizedImagePolicy =>
  isRecord(value) &&
  Array.isArray(value.localPatterns) &&
  Array.isArray(value.remotePatterns) &&
  value.remotePatterns.every((pattern) => isRecord(pattern) && typeof pattern.hostname === 'string') &&
  Array.isArray(value.widths) &&
  value.widths.every((item) => typeof item === 'number' && Number.isInteger(item) && item > 0) &&
  Array.isArray(value.heights) &&
  value.heights.every((item) => typeof item === 'number' && Number.isInteger(item) && item > 0) &&
  Array.isArray(value.qualities) &&
  value.qualities.every((item) => typeof item === 'number' && item >= 1 && item <= 100) &&
  Array.isArray(value.formats) &&
  value.formats.every((item) => ['image/avif', 'image/webp', 'image/jpeg', 'image/png'].includes(String(item))) &&
  typeof value.minimumCacheTTL === 'number' &&
  typeof value.dangerouslyAllowSVG === 'boolean' &&
  typeof value.contentSecurityPolicy === 'string' &&
  (value.contentDispositionType === 'inline' || value.contentDispositionType === 'attachment') &&
  typeof value.maximumRedirects === 'number' &&
  typeof value.maximumResponseBody === 'number' &&
  isRecord(value.variants);

/** Parses and structurally validates adapter metadata before deployment code consumes it. */
export const parseGigadriveNextBuildManifest = (content: string): GigadriveNextBuildManifest | undefined => {
  try {
    const value: unknown = JSON.parse(content);
    if (!isRecord(value)) return undefined;

    if (value.version === 1) {
      if (
        (value.output !== 'standalone' && value.output !== 'export') ||
        !isPortableRelativePath(value.distDir) ||
        !isPortableRelativePath(value.repoRootToProject, true) ||
        typeof value.nextVersion !== 'string' ||
        typeof value.buildId !== 'string'
      ) {
        return undefined;
      }
      return value as unknown as GigadriveNextBuildManifestV1;
    }

    if (
      value.version !== 2 ||
      (value.mode !== 'adapter-v2' && value.mode !== 'export') ||
      !isPortableRelativePath(value.distDir) ||
      !isPortableRelativePath(value.repoRootToProject, true) ||
      typeof value.nextVersion !== 'string' ||
      typeof value.buildId !== 'string' ||
      !isRecord(value.config) ||
      typeof value.config.basePath !== 'string' ||
      typeof value.config.trailingSlash !== 'boolean' ||
      typeof value.config.cacheComponents !== 'boolean' ||
      (value.config.images !== undefined && !isImagePolicy(value.config.images)) ||
      !isRecord(value.routing) ||
      !isJsonValue(value.routing) ||
      !isRecord(value.outputs) ||
      !Array.isArray(value.outputs.pages) ||
      !value.outputs.pages.every(isRouteOutput) ||
      !Array.isArray(value.outputs.pagesApi) ||
      !value.outputs.pagesApi.every(isRouteOutput) ||
      !Array.isArray(value.outputs.appPages) ||
      !value.outputs.appPages.every(isRouteOutput) ||
      !Array.isArray(value.outputs.appRoutes) ||
      !value.outputs.appRoutes.every(isRouteOutput) ||
      !Array.isArray(value.outputs.prerenders) ||
      !value.outputs.prerenders.every(isPrerenderOutput) ||
      !Array.isArray(value.outputs.staticFiles) ||
      !value.outputs.staticFiles.every(isStaticOutput) ||
      (value.outputs.middleware !== undefined && !isRouteOutput(value.outputs.middleware)) ||
      !Array.isArray(value.entrypoints) ||
      !value.entrypoints.every(isEntrypoint) ||
      !isStringRecord(value.outputEntrypoints)
    ) {
      return undefined;
    }

    const entrypointIds = new Set(value.entrypoints.map((item) => item.id));
    if (Object.values(value.outputEntrypoints).some((entrypointId) => !entrypointIds.has(entrypointId)))
      return undefined;

    return value as unknown as GigadriveNextBuildManifestV2;
  } catch {
    return undefined;
  }
};

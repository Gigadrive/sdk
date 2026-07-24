import type { NormalizedImagePolicy } from './image-policy';

/** JSON values accepted in the portable Next.js adapter manifest. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

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

/**
 * A directory subtree published under a single URL prefix, registered as one
 * descriptor instead of enumerating every file. Used to collapse `.next/static`
 * (thousands of content-hashed chunks) into a single edge-served prefix.
 */
export interface GigadriveNextStaticAssetPrefix {
  /** Project-relative source directory (e.g. `.next/static`). */
  sourceDir: string;
  /** Public URL prefix the subtree is served under (e.g. `_next/static`). */
  urlPrefix: string;
  /** Entries are content-hashed and safe to serve with immutable cache-control. */
  immutable: boolean;
}

export interface GigadriveNextBuildManifestV1 {
  version: 1;
  output: 'standalone' | 'export';
  distDir: string;
  repoRootToProject: string;
  nextVersion: string;
  buildId: string;
}

/** Aggregated runtime configuration collapsed onto the single standalone server. */
export interface GigadriveNextServerDescriptor {
  maxDuration?: number;
  preferredRegion?: string | string[];
  env?: Record<string, string>;
}

/**
 * Portable runtime plan for the single standalone Next.js server (Next >= 16.2).
 *
 * The whole deployment runs as one `next start` standalone server, so the plan
 * carries only what the platform needs to route around it: prerender/ISR/PPR
 * seeds, the `.next/static` prefix, and the routing/image configuration. It
 * deliberately omits per-route outputs and entrypoints — the server owns
 * routing, middleware, edge routes, and PPR resume in-process.
 */
export interface GigadriveNextBuildManifestV2Standalone {
  version: 2;
  mode: 'standalone-v2';
  distDir: string;
  repoRootToProject: string;
  nextVersion: string;
  buildId: string;
  server: GigadriveNextServerDescriptor;
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
    prerenders: GigadriveNextPrerenderOutput[];
    staticAssets: GigadriveNextStaticAssetPrefix[];
  };
}

/** Minimal plan for static-export builds (Next >= 16.2). */
export interface GigadriveNextBuildManifestV2Export {
  version: 2;
  mode: 'export';
  distDir: string;
  repoRootToProject: string;
  nextVersion: string;
  buildId: string;
}

export type GigadriveNextBuildManifestV2 = GigadriveNextBuildManifestV2Standalone | GigadriveNextBuildManifestV2Export;

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

const isStaticAssetPrefix = (value: unknown): value is GigadriveNextStaticAssetPrefix =>
  isRecord(value) &&
  isPortableRelativePath(value.sourceDir) &&
  isPortableRelativePath(value.urlPrefix) &&
  typeof value.immutable === 'boolean';

const isServerDescriptor = (value: unknown): value is GigadriveNextServerDescriptor =>
  isRecord(value) &&
  (value.maxDuration === undefined || typeof value.maxDuration === 'number') &&
  (value.preferredRegion === undefined ||
    typeof value.preferredRegion === 'string' ||
    (Array.isArray(value.preferredRegion) && value.preferredRegion.every((region) => typeof region === 'string'))) &&
  (value.env === undefined || isStringRecord(value.env));

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

    if (value.version === 2) {
      if (
        !isPortableRelativePath(value.distDir) ||
        !isPortableRelativePath(value.repoRootToProject, true) ||
        typeof value.nextVersion !== 'string' ||
        typeof value.buildId !== 'string'
      ) {
        return undefined;
      }

      if (value.mode === 'export') {
        return value as unknown as GigadriveNextBuildManifestV2Export;
      }

      if (value.mode === 'standalone-v2') {
        if (
          !isServerDescriptor(value.server) ||
          !isRecord(value.config) ||
          typeof value.config.basePath !== 'string' ||
          typeof value.config.trailingSlash !== 'boolean' ||
          typeof value.config.cacheComponents !== 'boolean' ||
          (value.config.images !== undefined && !isImagePolicy(value.config.images)) ||
          !isRecord(value.routing) ||
          !isJsonValue(value.routing) ||
          !isRecord(value.outputs) ||
          !Array.isArray(value.outputs.prerenders) ||
          !value.outputs.prerenders.every(isPrerenderOutput) ||
          !Array.isArray(value.outputs.staticAssets) ||
          !value.outputs.staticAssets.every(isStaticAssetPrefix)
        ) {
          return undefined;
        }
        return value as unknown as GigadriveNextBuildManifestV2Standalone;
      }

      // Legacy `mode: 'adapter-v2'` (per-route split) is no longer produced or consumed.
      return undefined;
    }

    return undefined;
  } catch {
    return undefined;
  }
};

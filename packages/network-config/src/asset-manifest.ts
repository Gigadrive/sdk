/** Response headers supported by a manifest-backed static asset. */
export type StaticAssetHeaders = Record<string, string | string[]>;

/** One logical static asset whose source is relative to the project root. */
export interface StaticAssetManifestEntry {
  /** Project-relative file containing the response body. */
  source: string;
  /** Absolute URL pathname at which the asset is available. */
  path: string;
  /** Response status. Defaults to 200. */
  status?: number;
  /** Response headers supplied with the asset. */
  headers?: StaticAssetHeaders;
  /** Whether the response body is content-addressed and can be cached indefinitely. */
  immutable?: boolean;
}

/** Portable manifest for declaring many logical assets without expanding deployment configuration. */
export interface StaticAssetManifestV1 {
  version: 1;
  assets: StaticAssetManifestEntry[];
}

export type StaticAssetManifest = StaticAssetManifestV1;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isPortableRelativePath = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
  return (
    normalized !== '' &&
    normalized !== '.' &&
    !normalized.startsWith('/') &&
    !/^[A-Za-z]:/.test(normalized) &&
    !normalized.includes(':') &&
    !normalized.split('/').some((segment) => segment === '..')
  );
};

const isUrlPathname = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('/') && !value.includes('?') && !value.includes('#');

const isHeaders = (value: unknown): value is StaticAssetHeaders =>
  isRecord(value) &&
  Object.values(value).every(
    (header) =>
      typeof header === 'string' || (Array.isArray(header) && header.every((item) => typeof item === 'string'))
  );

const isAsset = (value: unknown): value is StaticAssetManifestEntry =>
  isRecord(value) &&
  isPortableRelativePath(value.source) &&
  isUrlPathname(value.path) &&
  (value.status === undefined ||
    (typeof value.status === 'number' &&
      Number.isInteger(value.status) &&
      value.status >= 100 &&
      value.status <= 599)) &&
  (value.headers === undefined || isHeaders(value.headers)) &&
  (value.immutable === undefined || typeof value.immutable === 'boolean');

/**
 * Parses and validates a portable static asset manifest.
 *
 * @param content JSON manifest content.
 * @returns The validated manifest, or `undefined` when malformed.
 */
export const parseStaticAssetManifest = (content: string): StaticAssetManifest | undefined => {
  try {
    const value: unknown = JSON.parse(content);
    if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.assets) || !value.assets.every(isAsset)) {
      return undefined;
    }

    const paths = new Set<string>();
    for (const asset of value.assets) {
      if (paths.has(asset.path)) return undefined;
      paths.add(asset.path);
    }

    return value as unknown as StaticAssetManifestV1;
  } catch {
    return undefined;
  }
};

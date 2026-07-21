import { writeRuntimeCache } from './nextjs-runtime-cache-client';

interface ResponseCacheEntry {
  cacheControl?: unknown;
  value?: {
    kind?: unknown;
    html?: unknown;
    postponed?: unknown;
    headers?: unknown;
    status?: unknown;
  } | null;
}

interface PersistedPprCacheEntry {
  shell: string;
  postponedState?: string;
  headers: Record<string, string | string[]>;
  status?: number;
  cacheControl?: unknown;
}

const normalizeHeaders = (value: unknown): Record<string, string | string[]> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const headers: Record<string, string | string[]> = {};
  for (const [name, item] of Object.entries(value)) {
    if (typeof item === 'string' || typeof item === 'number') headers[name] = String(item);
    else if (Array.isArray(item) && item.every((entry) => typeof entry === 'string' || typeof entry === 'number')) {
      headers[name] = item.map(String);
    }
  }
  return headers;
};

const normalizeCacheKey = (value: string): string => {
  try {
    return new URL(value, 'https://gigadrive.invalid').pathname || '/';
  } catch {
    return value.startsWith('/') ? value : `/${value}`;
  }
};

const readShell = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (typeof value !== 'object' || value === null) return null;
  const toUnchunkedString = (value as { toUnchunkedString?: unknown }).toUnchunkedString;
  return typeof toUnchunkedString === 'function' ? String(toUnchunkedString.call(value)) : null;
};

/** Persists the atomic shell/postponed pair emitted by Next's PPR response cache. */
export const persistPprCacheEntry = async (cacheKey: string, cacheEntry: ResponseCacheEntry): Promise<void> => {
  if (cacheEntry.value?.kind !== 'APP_PAGE') return;
  const shell = readShell(cacheEntry.value.html);
  if (shell === null) return;

  const headers = normalizeHeaders(cacheEntry.value.headers);
  const tags = (headers['x-next-cache-tags'] ?? [])
    .toString()
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  const value: PersistedPprCacheEntry = {
    shell,
    ...(typeof cacheEntry.value.postponed === 'string' ? { postponedState: cacheEntry.value.postponed } : {}),
    headers,
    ...(typeof cacheEntry.value.status === 'number' ? { status: cacheEntry.value.status } : {}),
    ...(cacheEntry.cacheControl === undefined ? {} : { cacheControl: cacheEntry.cacheControl }),
  };

  await writeRuntimeCache('incremental', `ppr:${normalizeCacheKey(cacheKey)}`, value, tags);
};

interface RuntimeCacheEnvelope {
  value: unknown;
}

interface AccessTokenResponse {
  access_token: string;
  expires_in?: number;
}

export interface RuntimeCacheTagState {
  stale: number;
  expired: number;
}

let cachedToken: { value: string; expiresAt: number } | undefined;

const apiBaseUrl = (): string => (process.env.GIGADRIVE_API_URL ?? 'https://api.gigadrive.network').replace(/\/$/, '');

const encodeBinary = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (value instanceof Uint8Array) {
    return { __gigadriveType: 'bytes', value: Buffer.from(value).toString('base64') };
  }
  if (value instanceof ArrayBuffer) {
    return { __gigadriveType: 'bytes', value: Buffer.from(value).toString('base64') };
  }
  if (Array.isArray(value)) return value.map((item) => encodeBinary(item, seen));
  if (typeof value !== 'object' || value === null) return value;
  if (seen.has(value)) throw new Error('Next.js cache entry contains a circular value');
  seen.add(value);
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) result[key] = encodeBinary(item, seen);
  seen.delete(value);
  return result;
};

const decodeBinary = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(decodeBinary);
  if (typeof value !== 'object' || value === null) return value;
  const record = value as Record<string, unknown>;
  if (record.__gigadriveType === 'bytes' && typeof record.value === 'string')
    return Buffer.from(record.value, 'base64');
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, decodeBinary(item)]));
};

const getAccessToken = async (): Promise<string> => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  const clientId = process.env.GIGADRIVE_CLIENT_ID;
  const clientSecret = process.env.GIGADRIVE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Gigadrive workload credentials are unavailable');

  const response = await fetch(`${apiBaseUrl()}/oauth2/token`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) throw new Error(`Gigadrive workload authentication failed with status ${response.status}`);
  const token = (await response.json()) as AccessTokenResponse;
  if (!token.access_token) throw new Error('Gigadrive workload authentication returned no access token');
  cachedToken = {
    value: token.access_token,
    expiresAt: Date.now() + Math.max(60, token.expires_in ?? 300) * 1000,
  };
  return token.access_token;
};

const request = async (pathname: string, init: RequestInit, attempt = 0): Promise<Response> => {
  const token = await getAccessToken();
  try {
    const response = await fetch(`${apiBaseUrl()}${pathname}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'x-gigadrive-deployment-id': process.env.GIGADRIVE_DEPLOYMENT_ID ?? process.env.NEBULA_DEPLOYMENT_ID ?? '',
        'x-gigadrive-build-id': process.env.NEXT_BUILD_ID ?? '',
        ...init.headers,
      },
    });
    if (response.status === 401 && attempt === 0) {
      cachedToken = undefined;
      return request(pathname, init, attempt + 1);
    }
    if (response.status >= 500 && attempt < 2) return request(pathname, init, attempt + 1);
    return response;
  } catch (error) {
    if (attempt < 2) return request(pathname, init, attempt + 1);
    throw error;
  }
};

const cachePath = (kind: string, key: string): string =>
  `/internal/runtime-cache/v1/entries/${encodeURIComponent(kind)}/${encodeURIComponent(key)}`;

export const readRuntimeCache = async (kind: string, key: string): Promise<unknown | undefined> => {
  try {
    const response = await request(cachePath(kind, key), { method: 'GET' });
    if (response.status === 404) return undefined;
    if (!response.ok) return undefined;
    const envelope = (await response.json()) as RuntimeCacheEnvelope;
    return decodeBinary(envelope.value);
  } catch {
    return undefined;
  }
};

export const writeRuntimeCache = async (
  kind: string,
  key: string,
  value: unknown,
  tags: readonly string[] = []
): Promise<void> => {
  const response = await request(cachePath(kind, key), {
    method: 'PUT',
    body: JSON.stringify({ value: encodeBinary(value), tags }),
  });
  if (!response.ok) throw new Error(`Gigadrive runtime cache write failed with status ${response.status}`);
};

export const revalidateRuntimeCacheTags = async (
  kind: string,
  tags: readonly string[],
  durations?: { expire?: number }
): Promise<void> => {
  const response = await request('/internal/runtime-cache/v1/tags/revalidate', {
    method: 'POST',
    body: JSON.stringify({ kind, tags, durations }),
  });
  if (!response.ok) throw new Error(`Gigadrive runtime cache revalidation failed with status ${response.status}`);
};

export const getRuntimeCacheTagExpiration = async (kind: string, tags: readonly string[]): Promise<number> => {
  try {
    const response = await request('/internal/runtime-cache/v1/tags/expiration', {
      method: 'POST',
      body: JSON.stringify({ kind, tags }),
    });
    if (!response.ok) return 0;
    const value = (await response.json()) as { expiration?: unknown };
    return typeof value.expiration === 'number' ? value.expiration : 0;
  } catch {
    return 0;
  }
};

export const getRuntimeCacheTagState = async (kind: string, tags: readonly string[]): Promise<RuntimeCacheTagState> => {
  try {
    const response = await request('/internal/runtime-cache/v1/tags/state', {
      method: 'POST',
      body: JSON.stringify({ kind, tags }),
    });
    if (!response.ok) return { stale: 0, expired: 0 };
    const value = (await response.json()) as { stale?: unknown; expired?: unknown };
    return {
      stale: typeof value.stale === 'number' ? value.stale : 0,
      expired: typeof value.expired === 'number' ? value.expired : 0,
    };
  } catch {
    return { stale: 0, expired: 0 };
  }
};

export const resetRuntimeCacheClientForTests = (): void => {
  cachedToken = undefined;
};

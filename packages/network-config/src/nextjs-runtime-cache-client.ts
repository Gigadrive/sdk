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
  // Next stores App Router RSC segment payloads as a `Map<string, Buffer>`
  // (`segmentData`). `Object.entries` on a Map yields nothing, so without an
  // explicit branch the whole map would serialize to `{}` and every prefetched
  // segment would be silently lost on the next read.
  if (value instanceof Map) {
    if (seen.has(value)) throw new Error('Next.js cache entry contains a circular value');
    seen.add(value);
    const entries = [...value.entries()].map(([key, item]) => [encodeBinary(key, seen), encodeBinary(item, seen)]);
    seen.delete(value);
    return { __gigadriveType: 'map', value: entries };
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
  if (record.__gigadriveType === 'map' && Array.isArray(record.value)) {
    return new Map(
      (record.value as unknown[]).map((entry) => {
        const [key, item] = entry as [unknown, unknown];
        return [decodeBinary(key), decodeBinary(item)];
      })
    );
  }
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

const readEnvelope = async (
  kind: string,
  key: string,
  headers: Record<string, string> = {}
): Promise<RuntimeCacheEnvelope | undefined> => {
  try {
    const response = await request(cachePath(kind, key), { method: 'GET', headers });
    if (!response.ok) return undefined;
    return (await response.json()) as RuntimeCacheEnvelope;
  } catch {
    return undefined;
  }
};

export const readRuntimeCache = async (kind: string, key: string): Promise<unknown | undefined> => {
  const envelope = await readEnvelope(kind, key);
  return envelope && decodeBinary(envelope.value);
};

/** The API's limits on the soft tags of a combined read. */
const MAX_SOFT_TAGS = 128;
const MAX_TAG_LENGTH = 256;
/** Well under the header limits of the CDN and load balancer in front of the API. */
const MAX_SOFT_TAGS_HEADER_LENGTH = 4096;

/**
 * Reads an entry and, in the same request, the tag state of its own tags plus `softTags`.
 *
 * Saves the separate tag-state round trip on every hit. `tagState` is absent when the API answers
 * the entry alone (an API without combined reads, or soft tags too many or too long to send), so
 * the caller asks for it separately.
 */
export const readRuntimeCacheWithTagState = async (
  kind: string,
  key: string,
  softTags: readonly string[]
): Promise<{ value: unknown; tagState?: RuntimeCacheTagState } | undefined> => {
  const tags = [...new Set(softTags)];
  // Escape everything outside ASCII so the list is always a valid header value.
  const header = JSON.stringify(tags).replace(
    /[\u007f-\uffff]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
  const sendable =
    tags.length <= MAX_SOFT_TAGS &&
    tags.every((tag) => tag.length <= MAX_TAG_LENGTH) &&
    header.length <= MAX_SOFT_TAGS_HEADER_LENGTH;
  const envelope = await readEnvelope(kind, key, sendable ? { 'x-gigadrive-cache-soft-tags': header } : {});
  if (!envelope) return undefined;
  const state = (envelope as { tagState?: { stale?: unknown; expired?: unknown } }).tagState;
  return {
    value: decodeBinary(envelope.value),
    ...(typeof state?.stale === 'number' && typeof state.expired === 'number'
      ? { tagState: { stale: state.stale, expired: state.expired } }
      : {}),
  };
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

/**
 * Re-establishes the client's network state after a microVM resume.
 *
 * The guest runtime delivers SIGUSR2 when the instance is restored from a
 * suspend snapshot. At that moment every kept-alive TCP connection from before
 * the freeze is dead, and the cached OAuth token may have expired while the
 * clock was stopped. Dropping the token and dialing one throwaway read
 * re-opens TCP+TLS and refreshes the token concurrently with the guest's own
 * wake-up work, so the first real cache read after a resume does not
 * serialize behind reconnection.
 *
 * Registered only when a Gigadrive deployment marker is present in the
 * environment, so local `next dev`/`next build` never gains a signal listener.
 */
const registerResumeRewarm = (): void => {
  // Next exposes this marker before evaluating an Edge route bundle. Bail out
  // before touching `process`: its Edge compatibility proxy throws when the
  // Node-only signal API is read, including through Reflect.
  if (Reflect.has(globalThis, 'EdgeRuntime')) return;

  // The deployment id is intentionally available during `next build`, but the
  // shared cache client is also bundled into Edge routes at that point. Keep
  // every Node-only signal reference behind the build-phase guard so Turbopack
  // can eliminate this branch before its Edge runtime validation runs.
  if (process.env.GIGADRIVE_NEXT_BUILD === '1') return;

  const onGigadrive =
    process.env.GIGADRIVE_DEPLOYMENT_ID ?? process.env.NEBULA_DEPLOYMENT_ID ?? process.env.GIGADRIVE_CLIENT_ID;
  if (!onGigadrive) return;

  // Resolve the optional Node signal API reflectively so non-Node runtimes can
  // load the shared client while Node deployments retain resume rewarming.
  const runtimeProcess = Reflect.get(globalThis, 'process') as NodeJS.Process | undefined;
  const addSignalListener = runtimeProcess && Reflect.get(runtimeProcess, 'on');
  if (typeof addSignalListener !== 'function') return;

  Reflect.apply(addSignalListener, runtimeProcess, [
    'SIGUSR2',
    () => {
      cachedToken = undefined;
      if (!process.env.GIGADRIVE_CLIENT_ID || !process.env.GIGADRIVE_CLIENT_SECRET) return;
      void readRuntimeCache('warmup', '__resume__');
    },
  ]);
};
registerResumeRewarm();

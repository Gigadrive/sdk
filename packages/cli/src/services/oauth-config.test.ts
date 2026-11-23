import { FileSystem, Path } from '@effect/platform';
import { ConfigProvider, Effect, Layer, Logger, LogLevel } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DISCOVERY_LIFETIME_MS, discoveryLifetimeMs, OAuthConfigService } from './oauth-config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validDiscoveryDoc = {
  issuer: 'https://idp.example.com',
  authorization_endpoint: 'https://idp.example.com/authorize',
  token_endpoint: 'https://idp.example.com/token',
  userinfo_endpoint: 'https://idp.example.com/userinfo',
  device_authorization_endpoint: 'https://idp.example.com/device_authorization',
};

/** An in-memory file system holding the discovery cache. */
const memoryFs = (files: Map<string, string>) =>
  Layer.mergeAll(
    Layer.succeed(FileSystem.FileSystem, {
      readFileString: (path: string) =>
        files.has(path) ? Effect.succeed(files.get(path)!) : Effect.fail({ _tag: 'SystemError', message: 'ENOENT' }),
      writeFileString: (path: string, content: string) => Effect.sync(() => void files.set(path, content)),
      makeDirectory: () => Effect.void,
      remove: (path: string) => Effect.sync(() => void files.delete(path)),
    } as unknown as FileSystem.FileSystem),
    Layer.succeed(Path.Path, {
      join: (...segments: string[]) => segments.join('/'),
    } as unknown as Path.Path)
  );

const CACHE_FILE = '/cache/oidc-discovery.json';

const makeTestLayer = (envOverrides?: Record<string, string>, files = new Map<string, string>()) => {
  const env = {
    GIGADRIVE_NETWORK_OAUTH_ISSUER_URL: 'https://idp.example.com',
    GIGADRIVE_NETWORK_OAUTH_CLIENT_ID: 'test-client-id',
    GIGADRIVE_CACHE_DIR: '/cache',
    ...envOverrides,
  };

  const configLayer = Layer.setConfigProvider(ConfigProvider.fromMap(new Map(Object.entries(env))));

  // configLayer must wrap OAuthConfigService.Default so that Config.*
  // values resolved during layer construction see our overrides.
  return Layer.provide(OAuthConfigService.Default, Layer.merge(configLayer, memoryFs(files))).pipe(
    Layer.provideMerge(Logger.minimumLogLevel(LogLevel.None))
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OAuthConfigService.getConfig', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should fetch and return a valid OAuth config', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validDiscoveryDoc),
    });

    const testLayer = makeTestLayer();
    const result = await Effect.runPromise(Effect.provide(OAuthConfigService.getConfig, testLayer));

    expect(result.clientId).toBe('test-client-id');
    expect(result.issuer).toBe('https://idp.example.com');
    expect(result.authorizeUrl).toBe('https://idp.example.com/authorize');
    expect(result.tokenUrl).toBe('https://idp.example.com/token');
    expect(result.deviceAuthorizeUrl).toBe('https://idp.example.com/device_authorization');
    expect(result.userinfoUrl).toBe('https://idp.example.com/userinfo');
    // Identity scopes plus the Network API + platform capability scopes the CLI requests.
    expect(result.scope).toContain('offline_access');
    expect(result.scope).toContain('openid');
    expect(result.scope).toContain('platform:organizations:read');
    expect(result.scope).toContain('network:applications:write');
    expect(result.scope).toContain('network:env_vars:read');
    expect(result.scope).toContain('network:ai_gateway:chat');
    expect(result.scope).toContain('network:ai_gateway:models');
    expect(result.scope).toContain('platform:api_keys:write');
    for (const scope of [
      'network:microvms:read',
      'network:microvms:write',
      'network:microvms:exec',
      'network:microvms:delete',
      'network:microvm_images:read',
      'network:microvm_images:write',
      'network:microvm_images:delete',
    ]) {
      expect(result.scope.split(' ')).toContain(scope);
    }
  });

  it('should not request application-bound AI Gateway governance scopes', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validDiscoveryDoc),
    });

    const testLayer = makeTestLayer();
    const result = await Effect.runPromise(Effect.provide(OAuthConfigService.getConfig, testLayer));
    const requestedScopes = result.scope.split(' ');

    expect(requestedScopes).not.toContain('network:ai_gateway:usage:read');
    expect(requestedScopes).not.toContain('network:ai_gateway:budgets:read');
    expect(requestedScopes).not.toContain('network:ai_gateway:budgets:write');
    expect(requestedScopes).not.toContain('network:ai_gateway:policies:read');
    expect(requestedScopes).not.toContain('network:ai_gateway:policies:write');
  });

  it('should call the correct discovery URL', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validDiscoveryDoc),
    });

    const testLayer = makeTestLayer();
    await Effect.runPromise(Effect.provide(OAuthConfigService.getConfig, testLayer));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://idp.example.com/.well-known/openid-configuration',
      expect.objectContaining({ signal: expect.anything() })
    );
  });

  it('should strip trailing slash from issuer URL', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validDiscoveryDoc),
    });

    const testLayer = makeTestLayer({
      GIGADRIVE_NETWORK_OAUTH_ISSUER_URL: 'https://idp.example.com/',
    });

    await Effect.runPromise(Effect.provide(OAuthConfigService.getConfig, testLayer));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://idp.example.com/.well-known/openid-configuration',
      expect.anything()
    );
  });

  it('should fail with OAuthDiscoveryError when fetch fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const testLayer = makeTestLayer();
    const result = await Effect.runPromise(
      Effect.provide(OAuthConfigService.getConfig, testLayer).pipe(
        Effect.catchTag('OAuthDiscoveryError', (err) =>
          Effect.succeed({ _tag: 'caught' as const, message: err.message })
        )
      )
    );

    expect(result).toMatchObject({ _tag: 'caught', message: 'Failed to fetch OIDC discovery document' });
  });

  it('should fail with OAuthDiscoveryError when response is not OK', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const testLayer = makeTestLayer();
    const result = await Effect.runPromise(
      Effect.provide(OAuthConfigService.getConfig, testLayer).pipe(
        Effect.catchTag('OAuthDiscoveryError', (err) =>
          Effect.succeed({ _tag: 'caught' as const, message: err.message })
        )
      )
    );

    expect(result).toMatchObject({ _tag: 'caught' });
    expect((result as { message: string }).message).toContain('404');
  });

  it('should fail with OAuthDiscoveryError when response JSON is invalid', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error('Invalid JSON')),
    });

    const testLayer = makeTestLayer();
    const result = await Effect.runPromise(
      Effect.provide(OAuthConfigService.getConfig, testLayer).pipe(
        Effect.catchTag('OAuthDiscoveryError', (err) =>
          Effect.succeed({ _tag: 'caught' as const, message: err.message })
        )
      )
    );

    expect(result).toMatchObject({ _tag: 'caught', message: 'Failed to parse OIDC discovery JSON' });
  });

  it('should fail with OAuthDiscoveryError when endpoints are incomplete', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          issuer: 'https://idp.example.com',
          authorization_endpoint: 'https://idp.example.com/authorize',
          // Missing token_endpoint and userinfo_endpoint
        }),
    });

    const testLayer = makeTestLayer();
    const result = await Effect.runPromise(
      Effect.provide(OAuthConfigService.getConfig, testLayer).pipe(
        Effect.catchTag('OAuthDiscoveryError', (err) =>
          Effect.succeed({ _tag: 'caught' as const, message: err.message })
        )
      )
    );

    expect(result).toMatchObject({
      _tag: 'caught',
      message: 'OIDC discovery returned incomplete endpoints',
    });
  });

  it('should use issuer base as fallback when discovery doc omits issuer', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          // No issuer field
          authorization_endpoint: 'https://idp.example.com/authorize',
          token_endpoint: 'https://idp.example.com/token',
          userinfo_endpoint: 'https://idp.example.com/userinfo',
          device_authorization_endpoint: 'https://idp.example.com/device_authorization',
        }),
    });

    const testLayer = makeTestLayer();
    const result = await Effect.runPromise(Effect.provide(OAuthConfigService.getConfig, testLayer));

    expect(result.issuer).toBe('https://idp.example.com');
  });

  it('should fail with OAuthDiscoveryError when device_authorization_endpoint is missing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          issuer: 'https://idp.example.com',
          authorization_endpoint: 'https://idp.example.com/authorize',
          token_endpoint: 'https://idp.example.com/token',
          userinfo_endpoint: 'https://idp.example.com/userinfo',
          // Missing device_authorization_endpoint
        }),
    });

    const testLayer = makeTestLayer();
    const result = await Effect.runPromise(
      Effect.provide(OAuthConfigService.getConfig, testLayer).pipe(
        Effect.catchTag('OAuthDiscoveryError', (err) =>
          Effect.succeed({ _tag: 'caught' as const, message: err.message })
        )
      )
    );

    expect(result).toMatchObject({
      _tag: 'caught',
      message: 'OIDC discovery returned incomplete endpoints',
    });
  });
});

describe('OAuthConfigService discovery cache', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const respond = (headers: Record<string, string> = {}) =>
    vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(headers),
      json: () => Promise.resolve(validDiscoveryDoc),
    });

  it('reuses the document across runs while the cache headers allow it', async () => {
    const files = new Map<string, string>();
    globalThis.fetch = respond({ 'cache-control': 'public, max-age=300' });

    await Effect.runPromise(Effect.provide(OAuthConfigService.getConfig, makeTestLayer({}, files)));
    // A second run builds a new service, as a new CLI process would.
    const second = await Effect.runPromise(Effect.provide(OAuthConfigService.getConfig, makeTestLayer({}, files)));

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(second.tokenUrl).toBe('https://idp.example.com/token');
    const entry = JSON.parse(files.get(CACHE_FILE)!) as { expiresAt: number; issuer: string };
    expect(entry.issuer).toBe('https://idp.example.com');
    expect(entry.expiresAt - Date.now()).toBeLessThanOrEqual(300_000);
    expect(entry.expiresAt - Date.now()).toBeGreaterThan(290_000);
  });

  it('fetches again once the cached copy expired, and for another issuer', async () => {
    const files = new Map<string, string>([
      [CACHE_FILE, JSON.stringify({ issuer: 'https://idp.example.com', expiresAt: Date.now() - 1, document: {} })],
    ]);
    globalThis.fetch = respond();

    await Effect.runPromise(Effect.provide(OAuthConfigService.getConfig, makeTestLayer({}, files)));
    await Effect.runPromise(
      Effect.provide(
        OAuthConfigService.getConfig,
        makeTestLayer({ GIGADRIVE_NETWORK_OAUTH_ISSUER_URL: 'https://other.example.com' }, files)
      )
    );

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('uses a stale copy when the IDP cannot be reached', async () => {
    const files = new Map<string, string>([
      [
        CACHE_FILE,
        JSON.stringify({ issuer: 'https://idp.example.com', expiresAt: Date.now() - 1, document: validDiscoveryDoc }),
      ],
    ]);
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));

    const config = await Effect.runPromise(Effect.provide(OAuthConfigService.getConfig, makeTestLayer({}, files)));

    expect(config.userinfoUrl).toBe('https://idp.example.com/userinfo');
  });

  it('does not use a stale copy the IDP marked must-revalidate', async () => {
    const files = new Map<string, string>([
      [
        CACHE_FILE,
        JSON.stringify({
          issuer: 'https://idp.example.com',
          expiresAt: Date.now() - 1,
          mustRevalidate: true,
          document: validDiscoveryDoc,
        }),
      ],
    ]);
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));

    const result = await Effect.runPromise(
      Effect.either(Effect.provide(OAuthConfigService.getConfig, makeTestLayer({}, files)))
    );

    expect(result._tag).toBe('Left');
  });

  it('records must-revalidate with the document', async () => {
    const files = new Map<string, string>();
    globalThis.fetch = respond({ 'cache-control': 'max-age=60, must-revalidate' });

    await Effect.runPromise(Effect.provide(OAuthConfigService.getConfig, makeTestLayer({}, files)));

    expect(JSON.parse(files.get(CACHE_FILE)!)).toMatchObject({ mustRevalidate: true });
  });

  it('drops an older copy when the IDP marks the new document no-store', async () => {
    const files = new Map<string, string>([
      [CACHE_FILE, JSON.stringify({ issuer: 'https://idp.example.com', expiresAt: Date.now() - 1, document: {} })],
    ]);
    globalThis.fetch = respond({ 'cache-control': 'no-store' });

    await Effect.runPromise(Effect.provide(OAuthConfigService.getConfig, makeTestLayer({}, files)));

    expect(files.has(CACHE_FILE)).toBe(false);
  });

  it('reads the lifetime from Cache-Control, Expires, or falls back to 24 hours', () => {
    const now = Date.parse('2026-11-23T12:00:00Z');
    expect(discoveryLifetimeMs(new Headers({ 'cache-control': 'public, max-age=300' }), now)).toBe(300_000);
    expect(discoveryLifetimeMs(new Headers({ 'cache-control': 'x-max-age=86400, max-age=60' }), now)).toBe(60_000);
    expect(discoveryLifetimeMs(new Headers({ 'cache-control': 'max-age=12abc' }), now)).toBe(0);
    expect(discoveryLifetimeMs(new Headers({ 'cache-control': 'no-cache' }), now)).toBe(0);
    expect(discoveryLifetimeMs(new Headers({ expires: 'Mon, 23 Nov 2026 13:00:00 GMT' }), now)).toBe(3_600_000);
    expect(discoveryLifetimeMs(new Headers({ expires: 'garbage' }), now)).toBe(0);
    expect(discoveryLifetimeMs(new Headers(), now)).toBe(DEFAULT_DISCOVERY_LIFETIME_MS);
    expect(discoveryLifetimeMs(undefined, now)).toBe(DEFAULT_DISCOVERY_LIFETIME_MS);
  });
});

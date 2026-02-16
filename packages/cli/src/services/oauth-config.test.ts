import { ConfigProvider, Effect, Layer, Logger, LogLevel } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OAuthConfigService } from './oauth-config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validDiscoveryDoc = {
  issuer: 'https://idp.example.com',
  authorization_endpoint: 'https://idp.example.com/authorize',
  token_endpoint: 'https://idp.example.com/token',
  userinfo_endpoint: 'https://idp.example.com/userinfo',
};

const makeTestLayer = (envOverrides?: Record<string, string>) => {
  const env = {
    GIGADRIVE_NETWORK_OAUTH_ISSUER_URL: 'https://idp.example.com',
    GIGADRIVE_NETWORK_OAUTH_CLIENT_ID: 'test-client-id',
    ...envOverrides,
  };

  const configLayer = Layer.setConfigProvider(ConfigProvider.fromMap(new Map(Object.entries(env))));

  // configLayer must wrap OAuthConfigService.Default so that Config.*
  // values resolved during layer construction see our overrides.
  return Layer.provide(OAuthConfigService.Default, configLayer).pipe(
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

    expect(result).toEqual({
      clientId: 'test-client-id',
      issuer: 'https://idp.example.com',
      authorizeUrl: 'https://idp.example.com/authorize',
      tokenUrl: 'https://idp.example.com/token',
      scope: 'offline_access openid profile email',
      userinfoUrl: 'https://idp.example.com/userinfo',
    });
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
        }),
    });

    const testLayer = makeTestLayer();
    const result = await Effect.runPromise(Effect.provide(OAuthConfigService.getConfig, testLayer));

    expect(result.issuer).toBe('https://idp.example.com');
  });
});

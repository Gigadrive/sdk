import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthenticationError } from '../errors';
import {
  BearerTokenProvider,
  OAuth2AuthorizationCodeProvider,
  OAuth2ClientCredentialProvider,
  OAuth2RefreshTokenProvider,
  resolveCredentialProvider,
} from './credential-provider';

const mockFetch = vi.fn<typeof globalThis.fetch>();

describe('BearerTokenProvider', () => {
  it('should return the static token', async () => {
    const provider = new BearerTokenProvider('my-token');
    const result = await provider.getToken();

    expect(result.accessToken).toBe('my-token');
    expect(result.expiresAt).toBeNull();
  });

  it('should have type bearer', () => {
    const provider = new BearerTokenProvider('my-token');
    expect(provider.type).toBe('bearer');
  });
});

describe('OAuth2ClientCredentialProvider', () => {
  it('should exchange client credentials for a token', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'access-123', expires_in: 300, scope: 'openid' }), { status: 200 })
    );

    const provider = new OAuth2ClientCredentialProvider(
      'client-id',
      'client-secret',
      'https://api.example.com/oauth2/token',
      mockFetch
    );

    const result = await provider.getToken();

    expect(result.accessToken).toBe('access-123');
    expect(result.expiresAt).toBeGreaterThan(Date.now());
    expect(result.expiresAt).toBeLessThanOrEqual(Date.now() + 270 * 1000);

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa('client-id:client-secret')}`,
      },
      body: 'grant_type=client_credentials',
    });
  });

  it('should throw AuthenticationError on failure', async () => {
    mockFetch.mockResolvedValueOnce(new Response('invalid_client', { status: 401 }));

    const provider = new OAuth2ClientCredentialProvider(
      'bad-id',
      'bad-secret',
      'https://api.example.com/oauth2/token',
      mockFetch
    );

    await expect(provider.getToken()).rejects.toThrow(AuthenticationError);
  });

  it('should throw when the token response has no access_token', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ expires_in: 300 }), { status: 200 }));

    const provider = new OAuth2ClientCredentialProvider(
      'client-id',
      'client-secret',
      'https://api.example.com/oauth2/token',
      mockFetch
    );

    await expect(provider.getToken()).rejects.toThrow(/no access_token/i);
  });
});

describe('OAuth2RefreshTokenProvider', () => {
  it('should exchange refresh token for access token via OIDC discovery', async () => {
    // OIDC discovery
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          token_endpoint: 'https://idp.example.com/oauth2/token',
          authorization_endpoint: 'https://idp.example.com/oauth2/authorize',
        }),
        { status: 200 }
      )
    );

    // Token exchange
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 3600,
        }),
        { status: 200 }
      )
    );

    const provider = new OAuth2RefreshTokenProvider('client-id', 'old-refresh', 'https://idp.example.com', mockFetch);
    const result = await provider.getToken();

    expect(result.accessToken).toBe('new-access');
    expect(result.refreshToken).toBe('new-refresh');
    expect(result.expiresAt).toBeGreaterThan(Date.now());
  });

  it('should throw AuthenticationError when refresh token is invalid', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ token_endpoint: 'https://idp.example.com/oauth2/token' }), { status: 200 })
    );
    mockFetch.mockResolvedValueOnce(new Response('invalid_grant', { status: 400 }));

    const provider = new OAuth2RefreshTokenProvider('client-id', 'bad-refresh', 'https://idp.example.com', mockFetch);

    await expect(provider.getToken()).rejects.toThrow('Refresh token is invalid or expired');
  });
});

describe('OAuth2AuthorizationCodeProvider', () => {
  it('exchanges a code on first use, then refreshes silently without re-prompting', async () => {
    const discovery = {
      authorization_endpoint: 'https://idp.example/authorize',
      token_endpoint: 'https://idp.example/token',
    };
    let exchanges = 0;
    let refreshes = 0;
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.includes('.well-known')) {
        return new Response(JSON.stringify(discovery), { status: 200 });
      }
      const body = String(init?.body ?? '');
      if (body.includes('grant_type=authorization_code')) {
        exchanges++;
        return new Response(JSON.stringify({ access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 300 }), {
          status: 200,
        });
      }
      if (body.includes('grant_type=refresh_token')) {
        refreshes++;
        return new Response(JSON.stringify({ access_token: 'access-2', expires_in: 300 }), { status: 200 });
      }
      return new Response('bad request', { status: 400 });
    });

    let prompts = 0;
    const onAuthorizationUrl = async (url: string): Promise<string> => {
      prompts++;
      const state = new URL(url).searchParams.get('state');
      return `https://app.example/callback?code=abc&state=${state}`;
    };

    const provider = new OAuth2AuthorizationCodeProvider(
      'client-id',
      'https://idp.example',
      'urn:ietf:wg:oauth:2.0:oob',
      onAuthorizationUrl,
      fetchImpl as unknown as typeof globalThis.fetch
    );

    const first = await provider.getToken();
    expect(first.accessToken).toBe('access-1');
    expect(prompts).toBe(1);

    const second = await provider.getToken();
    expect(second.accessToken).toBe('access-2');
    expect(prompts).toBe(1); // not re-prompted
    expect(exchanges).toBe(1);
    expect(refreshes).toBe(1);
  });
});

describe('resolveCredentialProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use explicit bearerToken', () => {
    const provider = resolveCredentialProvider({ bearerToken: 'my-token', fetch: mockFetch });
    expect(provider.type).toBe('bearer');
  });

  it('should use explicit clientId + clientSecret', () => {
    const provider = resolveCredentialProvider({ clientId: 'id', clientSecret: 'secret', fetch: mockFetch });
    expect(provider.type).toBe('oauth2-client-credentials');
  });

  it('should use explicit refreshToken + clientId', () => {
    const provider = resolveCredentialProvider({ clientId: 'id', refreshToken: 'refresh', fetch: mockFetch });
    expect(provider.type).toBe('oauth2-refresh-token');
  });

  it('should use explicit onAuthorizationUrl + clientId', () => {
    const provider = resolveCredentialProvider({
      clientId: 'id',
      onAuthorizationUrl: async () => 'code',
      fetch: mockFetch,
    });
    expect(provider.type).toBe('oauth2-authorization-code');
  });

  it('should fall back to GIGADRIVE_BEARER_TOKEN env var', () => {
    process.env.GIGADRIVE_BEARER_TOKEN = 'env-token';
    const provider = resolveCredentialProvider({ fetch: mockFetch });
    expect(provider.type).toBe('bearer');
  });

  it('should fall back to GIGADRIVE_CLIENT_ID + GIGADRIVE_CLIENT_SECRET env vars', () => {
    process.env.GIGADRIVE_CLIENT_ID = 'env-id';
    process.env.GIGADRIVE_CLIENT_SECRET = 'env-secret';
    const provider = resolveCredentialProvider({ fetch: mockFetch });
    expect(provider.type).toBe('oauth2-client-credentials');
  });

  it('should fall back to GIGADRIVE_REFRESH_TOKEN + GIGADRIVE_CLIENT_ID env vars', () => {
    process.env.GIGADRIVE_CLIENT_ID = 'env-id';
    process.env.GIGADRIVE_REFRESH_TOKEN = 'env-refresh';
    const provider = resolveCredentialProvider({ fetch: mockFetch });
    expect(provider.type).toBe('oauth2-refresh-token');
  });

  it('should throw AuthenticationError when no credentials are found', () => {
    delete process.env.GIGADRIVE_BEARER_TOKEN;
    delete process.env.GIGADRIVE_CLIENT_ID;
    delete process.env.GIGADRIVE_CLIENT_SECRET;
    delete process.env.GIGADRIVE_REFRESH_TOKEN;
    expect(() => resolveCredentialProvider({ fetch: mockFetch })).toThrow(AuthenticationError);
  });

  it('should prioritize explicit config over env vars', () => {
    process.env.GIGADRIVE_BEARER_TOKEN = 'env-token';
    const provider = resolveCredentialProvider({ clientId: 'id', clientSecret: 'secret', fetch: mockFetch });
    expect(provider.type).toBe('oauth2-client-credentials');
  });
});

import { AuthenticationError } from '../errors';

const DEFAULT_SCOPE = 'offline_access openid profile email';
const TOKEN_EXPIRY_MARGIN_SECONDS = 30;

/**
 * Compute the absolute expiry (epoch ms) for a token, applying a safety margin
 * so the SDK refreshes proactively. The margin is clamped to never exceed half
 * the token lifetime, so very short-lived tokens are not treated as already
 * expired (which would refresh on every request).
 */
const computeExpiresAt = (expiresInSeconds: number | undefined): number => {
  const ttl = expiresInSeconds ?? 3600;
  const margin = Math.min(TOKEN_EXPIRY_MARGIN_SECONDS, ttl / 2);
  return Date.now() + (ttl - margin) * 1000;
};

/**
 * Read an environment variable safely. Returns `undefined` when `process` is
 * unavailable (e.g. browsers / some edge runtimes) instead of throwing.
 *
 * @internal
 */
export const readEnv = (name: string): string | undefined => {
  if (typeof process === 'undefined' || !process.env) return undefined;
  return process.env[name];
};

interface RawTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

/**
 * Validate and normalize a token-endpoint JSON response, guarding against
 * malformed payloads that would otherwise yield `Authorization: Bearer undefined`.
 */
const parseTokenResponse = (payload: unknown): RawTokenResponse => {
  const data = payload as { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown };
  if (typeof data.access_token !== 'string' || data.access_token.length === 0) {
    throw new AuthenticationError('Token endpoint returned no access_token');
  }
  return {
    access_token: data.access_token,
    refresh_token: typeof data.refresh_token === 'string' ? data.refresh_token : undefined,
    expires_in: typeof data.expires_in === 'number' ? data.expires_in : undefined,
  };
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The result of a credential provider's token fetch. */
export interface TokenResult {
  /** The access token to use in API requests. */
  accessToken: string;
  /** Epoch milliseconds when the token expires, or `null` for tokens that never expire (e.g. static bearer tokens). */
  expiresAt: number | null;
  /** A refresh token for obtaining new access tokens, if the provider supports token rotation. */
  refreshToken?: string;
}

/**
 * A strategy for obtaining access tokens. The SDK ships with four built-in
 * providers (see {@link resolveCredentialProvider} for automatic selection),
 * but you can implement this interface for custom auth flows.
 */
export interface CredentialProvider {
  /** A string identifying the provider type (e.g. `"oauth2-client-credentials"`, `"bearer"`). */
  readonly type: string;
  /** Fetch a new access token. May perform network requests (e.g. OAuth2 token exchange). */
  getToken(): Promise<TokenResult>;
}

interface OidcDiscoveryDocument {
  token_endpoint?: string;
  authorization_endpoint?: string;
  userinfo_endpoint?: string;
}

// ---------------------------------------------------------------------------
// OIDC Discovery
// ---------------------------------------------------------------------------

const discoverOidc = async (issuerUrl: string, fetchFn: typeof globalThis.fetch): Promise<OidcDiscoveryDocument> => {
  const discoveryUrl = `${issuerUrl.replace(/\/$/, '')}/.well-known/openid-configuration`;
  const response = await fetchFn(discoveryUrl);

  if (!response.ok) {
    throw new AuthenticationError(`OIDC discovery failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as OidcDiscoveryDocument;
};

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

const base64UrlEncode = (buffer: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

const generatePkce = async (): Promise<{ codeVerifier: string; codeChallenge: string }> => {
  const randomBytes = new Uint8Array(64);
  crypto.getRandomValues(randomBytes);
  const codeVerifier = base64UrlEncode(randomBytes);

  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const codeChallenge = base64UrlEncode(new Uint8Array(digest));

  return { codeVerifier, codeChallenge };
};

const generateState = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

// ---------------------------------------------------------------------------
// OAuth2 Client Credentials Provider (Network API keys)
// ---------------------------------------------------------------------------

/**
 * Authenticates using the OAuth2 client credentials grant. Exchanges an
 * API key (client ID + secret) for a short-lived access token via the
 * Gigadrive Network token endpoint.
 *
 * Tokens are valid for 5 minutes. A 30-second safety margin is applied so
 * the SDK refreshes proactively before the token actually expires.
 *
 * This is the most common provider for server-to-server (machine-to-machine)
 * use cases.
 */
export class OAuth2ClientCredentialProvider implements CredentialProvider {
  readonly type = 'oauth2-client-credentials';

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly tokenUrl: string,
    private readonly fetchFn: typeof globalThis.fetch
  ) {}

  async getToken(): Promise<TokenResult> {
    const credentials = btoa(`${this.clientId}:${this.clientSecret}`);

    const response = await this.fetchFn(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new AuthenticationError(`OAuth2 token request failed (${response.status}): ${body}`);
    }

    const data = parseTokenResponse(await response.json());

    return {
      accessToken: data.access_token,
      expiresAt: computeExpiresAt(data.expires_in),
    };
  }
}

// ---------------------------------------------------------------------------
// OAuth2 Authorization Code Provider (IDP, PKCE, no local server)
// ---------------------------------------------------------------------------

/**
 * Authenticates using the OAuth2 authorization code grant with PKCE. This
 * provider is designed for interactive flows where a user authorizes the
 * application via a browser.
 *
 * The SDK generates the PKCE challenge, builds the authorization URL, and
 * passes it to your `onAuthorizationUrl` callback. Your callback is
 * responsible for presenting the URL to the user and returning the result
 * (either the full redirect URL or just the authorization code).
 *
 * The provider performs OIDC discovery to locate the authorization and token
 * endpoints automatically.
 */
export class OAuth2AuthorizationCodeProvider implements CredentialProvider {
  readonly type = 'oauth2-authorization-code';
  private currentRefreshToken: string | null = null;

  constructor(
    private readonly clientId: string,
    private readonly issuerUrl: string,
    private readonly redirectUri: string,
    private readonly onAuthorizationUrl: (url: string) => Promise<string>,
    private readonly fetchFn: typeof globalThis.fetch,
    private readonly scope: string = DEFAULT_SCOPE
  ) {}

  async getToken(): Promise<TokenResult> {
    const oidc = await discoverOidc(this.issuerUrl, this.fetchFn);

    if (!oidc.token_endpoint) {
      throw new AuthenticationError('OIDC discovery returned no token endpoint');
    }

    // After the first interactive exchange, refresh silently rather than
    // re-prompting the user. Only fall back to a fresh authorization when the
    // refresh token is actually rejected — transient errors are surfaced.
    if (this.currentRefreshToken) {
      const refreshed = await this.tryRefresh(oidc.token_endpoint, this.currentRefreshToken);
      if (refreshed) return refreshed;
      this.currentRefreshToken = null;
    }

    if (!oidc.authorization_endpoint) {
      throw new AuthenticationError('OIDC discovery returned incomplete endpoints');
    }

    const { codeVerifier, codeChallenge } = await generatePkce();
    const state = generateState();

    const authUrl = new URL(oidc.authorization_endpoint);
    authUrl.searchParams.set('client_id', this.clientId);
    authUrl.searchParams.set('redirect_uri', this.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', this.scope);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);

    const result = await this.onAuthorizationUrl(authUrl.toString());

    // Extract the authorization code — accept either a full URL or just the code
    let code: string;
    let returnedState: string | null = null;

    try {
      const callbackUrl = new URL(result);
      code = callbackUrl.searchParams.get('code') ?? '';
      returnedState = callbackUrl.searchParams.get('state');

      const error = callbackUrl.searchParams.get('error');
      if (error) {
        const description = callbackUrl.searchParams.get('error_description') ?? error;
        throw new AuthenticationError(`Authorization failed: ${description}`);
      }
    } catch (e) {
      if (e instanceof AuthenticationError) throw e;
      // Not a valid URL — treat the entire result as the code
      code = result;
    }

    if (!code) {
      throw new AuthenticationError('No authorization code received');
    }

    if (returnedState !== null && returnedState !== state) {
      throw new AuthenticationError('State mismatch — possible CSRF attack');
    }

    // Exchange code for tokens
    const response = await this.fetchFn(oidc.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        code,
        redirect_uri: this.redirectUri,
        code_verifier: codeVerifier,
      }).toString(),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new AuthenticationError(`Token exchange failed (${response.status}): ${body}`);
    }

    const data = parseTokenResponse(await response.json());

    this.currentRefreshToken = data.refresh_token ?? null;

    return {
      accessToken: data.access_token,
      expiresAt: computeExpiresAt(data.expires_in),
      refreshToken: data.refresh_token,
    };
  }

  /**
   * Try to exchange the stored refresh token for a new access token. Returns the
   * token on success, `null` when the refresh token is definitively rejected
   * (a 4xx — caller should re-authenticate), and throws on transient failures.
   */
  private async tryRefresh(tokenEndpoint: string, refreshToken: string): Promise<TokenResult | null> {
    const response = await this.fetchFn(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) {
      // A 4xx means the refresh token is invalid/expired — re-authenticate.
      if (response.status >= 400 && response.status < 500) return null;
      // Transient (network/5xx) failures surface instead of forcing a re-prompt.
      const body = await response.text().catch(() => '');
      throw new AuthenticationError(`Token refresh failed (${response.status}): ${body}`);
    }

    const data = parseTokenResponse(await response.json());

    if (data.refresh_token) {
      this.currentRefreshToken = data.refresh_token;
    }

    return {
      accessToken: data.access_token,
      expiresAt: computeExpiresAt(data.expires_in),
      refreshToken: data.refresh_token ?? this.currentRefreshToken ?? undefined,
    };
  }
}

// ---------------------------------------------------------------------------
// OAuth2 Refresh Token Provider (IDP)
// ---------------------------------------------------------------------------

/**
 * Authenticates using an IDP refresh token. Exchanges the refresh token for
 * a short-lived access token via the IDP's token endpoint (discovered via
 * OIDC). Handles refresh-token rotation automatically — if the IDP issues
 * a new refresh token, it is stored internally for subsequent refreshes.
 *
 * This provider is typically used when a user has previously logged in
 * (e.g. via the CLI) and you have a stored refresh token.
 */
export class OAuth2RefreshTokenProvider implements CredentialProvider {
  readonly type = 'oauth2-refresh-token';
  private currentRefreshToken: string;

  constructor(
    private readonly clientId: string,
    refreshToken: string,
    private readonly issuerUrl: string,
    private readonly fetchFn: typeof globalThis.fetch
  ) {
    this.currentRefreshToken = refreshToken;
  }

  async getToken(): Promise<TokenResult> {
    const oidc = await discoverOidc(this.issuerUrl, this.fetchFn);

    if (!oidc.token_endpoint) {
      throw new AuthenticationError('OIDC discovery returned no token endpoint');
    }

    const response = await this.fetchFn(oidc.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        refresh_token: this.currentRefreshToken,
      }).toString(),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      if (response.status === 400) {
        throw new AuthenticationError('Refresh token is invalid or expired. Please re-authenticate.');
      }
      throw new AuthenticationError(`Token refresh failed (${response.status}): ${body}`);
    }

    const data = parseTokenResponse(await response.json());

    // Handle refresh token rotation
    if (data.refresh_token) {
      this.currentRefreshToken = data.refresh_token;
    }

    return {
      accessToken: data.access_token,
      expiresAt: computeExpiresAt(data.expires_in),
      refreshToken: data.refresh_token ?? this.currentRefreshToken,
    };
  }
}

// ---------------------------------------------------------------------------
// Bearer Token Provider (static)
// ---------------------------------------------------------------------------

/**
 * Uses a static, pre-obtained bearer token. The token is never refreshed —
 * if it expires, API requests will fail with an {@link AuthenticationError}.
 *
 * This is the simplest provider and is used when the caller already has a
 * valid access token (e.g. from an external auth flow or a long-lived token).
 */
export class BearerTokenProvider implements CredentialProvider {
  readonly type = 'bearer';

  constructor(private readonly token: string) {}

  getToken(): Promise<TokenResult> {
    return Promise.resolve({ accessToken: this.token, expiresAt: null });
  }
}

// ---------------------------------------------------------------------------
// Credential resolution
// ---------------------------------------------------------------------------

export interface CredentialResolverConfig {
  clientId?: string;
  clientSecret?: string;
  bearerToken?: string;
  refreshToken?: string;
  idpIssuerUrl?: string;
  onAuthorizationUrl?: (url: string) => Promise<string>;
  redirectUri?: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  /** OAuth scopes to request in the authorization-code flow (in addition to identity scopes). */
  scopes?: string[];
}

const DEFAULT_IDP_ISSUER_URL = 'https://idp.gigadrive.de';
const DEFAULT_BASE_URL = 'https://api.gigadrive.network';

/**
 * Resolves a `CredentialProvider` from explicit config or environment variables.
 *
 * Resolution order:
 * 1. Explicit `bearerToken` → BearerTokenProvider
 * 2. Explicit `clientId` + `clientSecret` → OAuth2ClientCredentialProvider
 * 3. Explicit `refreshToken` + `clientId` → OAuth2RefreshTokenProvider
 * 4. Explicit `onAuthorizationUrl` + `clientId` → OAuth2AuthorizationCodeProvider
 * 5. `GIGADRIVE_BEARER_TOKEN` env var → BearerTokenProvider
 * 6. `GIGADRIVE_CLIENT_ID` + `GIGADRIVE_CLIENT_SECRET` → OAuth2ClientCredentialProvider
 * 7. `GIGADRIVE_REFRESH_TOKEN` + `GIGADRIVE_CLIENT_ID` → OAuth2RefreshTokenProvider
 * 8. Throws AuthenticationError
 */
export const resolveCredentialProvider = (config: CredentialResolverConfig): CredentialProvider => {
  // Bind the default fetch to globalThis so calling it as `this.fetchFn(...)`
  // does not throw "Illegal invocation" in runtimes that require a bound receiver.
  const fetchFn = config.fetch ?? globalThis.fetch.bind(globalThis);
  const baseUrl = config.baseUrl ?? readEnv('GIGADRIVE_API_BASE_URL') ?? DEFAULT_BASE_URL;
  const idpIssuerUrl = config.idpIssuerUrl ?? readEnv('GIGADRIVE_IDP_ISSUER_URL') ?? DEFAULT_IDP_ISSUER_URL;
  const tokenUrl = `${baseUrl}/oauth2/token`;

  // 1. Explicit bearer token
  if (config.bearerToken) {
    return new BearerTokenProvider(config.bearerToken);
  }

  // 2. Explicit client credentials
  if (config.clientId && config.clientSecret) {
    return new OAuth2ClientCredentialProvider(config.clientId, config.clientSecret, tokenUrl, fetchFn);
  }

  // 3. Explicit refresh token
  if (config.refreshToken && config.clientId) {
    return new OAuth2RefreshTokenProvider(config.clientId, config.refreshToken, idpIssuerUrl, fetchFn);
  }

  // 4. Explicit authorization code callback
  if (config.onAuthorizationUrl && config.clientId) {
    const redirectUri = config.redirectUri ?? 'urn:ietf:wg:oauth:2.0:oob';
    const scope = config.scopes && config.scopes.length > 0 ? config.scopes.join(' ') : DEFAULT_SCOPE;
    return new OAuth2AuthorizationCodeProvider(
      config.clientId,
      idpIssuerUrl,
      redirectUri,
      config.onAuthorizationUrl,
      fetchFn,
      scope
    );
  }

  // 5. GIGADRIVE_BEARER_TOKEN env var
  const envBearerToken = readEnv('GIGADRIVE_BEARER_TOKEN');
  if (envBearerToken) {
    return new BearerTokenProvider(envBearerToken);
  }

  // 6. GIGADRIVE_CLIENT_ID + GIGADRIVE_CLIENT_SECRET env vars
  const envClientId = readEnv('GIGADRIVE_CLIENT_ID');
  const envClientSecret = readEnv('GIGADRIVE_CLIENT_SECRET');
  if (envClientId && envClientSecret) {
    return new OAuth2ClientCredentialProvider(envClientId, envClientSecret, tokenUrl, fetchFn);
  }

  // 7. GIGADRIVE_REFRESH_TOKEN + GIGADRIVE_CLIENT_ID env vars
  const envRefreshToken = readEnv('GIGADRIVE_REFRESH_TOKEN');
  if (envRefreshToken && envClientId) {
    return new OAuth2RefreshTokenProvider(envClientId, envRefreshToken, idpIssuerUrl, fetchFn);
  }

  // 8. No credentials found
  throw new AuthenticationError(
    'No credentials provided. Set one of:\n' +
      '  - GIGADRIVE_BEARER_TOKEN\n' +
      '  - GIGADRIVE_CLIENT_ID + GIGADRIVE_CLIENT_SECRET\n' +
      '  - GIGADRIVE_REFRESH_TOKEN + GIGADRIVE_CLIENT_ID\n' +
      'Or pass credentials directly to the GigadriveClient constructor.'
  );
};

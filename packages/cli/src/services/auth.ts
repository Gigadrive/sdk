import { Console, Effect, Option } from 'effect';
import * as crypto from 'node:crypto';
import * as http from 'node:http';
import open from 'open';
import type { OAuthClientConfig, StoredAuthData } from '../domain';
import {
  LoginFlowError,
  NotAuthenticatedError,
  TokenExchangeError,
  TokenRefreshError,
  UserInfoFetchError,
} from '../errors';
import { AuthStorageService } from './auth-storage';
import { OAuthConfigService } from './oauth-config';

// Simple HTML escaping to prevent reflected XSS when rendering user input
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');

// ---------------------------------------------------------------------------
// PKCE helpers (exported for testing)
// ---------------------------------------------------------------------------

/** @internal */
export const base64URLEncode = (buffer: Buffer): string =>
  buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

/** @internal */
export const generatePKCE = () => {
  const codeVerifier = base64URLEncode(crypto.randomBytes(64));
  const challengeBytes = crypto.createHash('sha256').update(codeVerifier, 'utf8').digest();
  const codeChallenge = base64URLEncode(challengeBytes);
  return { codeVerifier, codeChallenge };
};

// ---------------------------------------------------------------------------
// AuthService
// ---------------------------------------------------------------------------

export class AuthService extends Effect.Service<AuthService>()('AuthService', {
  accessors: true,
  dependencies: [OAuthConfigService.Default, AuthStorageService.Default],

  effect: Effect.gen(function* () {
    const oauthConfig = yield* OAuthConfigService;
    const storage = yield* AuthStorageService;

    // In-memory token cache
    let accessToken: string | null = null;
    let tokenExpirationTime = 0;

    const logout = Effect.gen(function* () {
      accessToken = null;
      tokenExpirationTime = 0;
      yield* storage.remove;
      yield* Effect.log('Logged out');
    });

    const exchangeCodeForTokens = (
      config: OAuthClientConfig,
      authCode: string,
      redirectUri: string,
      codeVerifier: string
    ) =>
      Effect.gen(function* () {
        const response = yield* Effect.tryPromise({
          try: () =>
            fetch(config.tokenUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: config.clientId,
                code: authCode,
                redirect_uri: redirectUri,
                code_verifier: codeVerifier,
              }).toString(),
            }),
          catch: (error) =>
            new TokenExchangeError({
              message: `Token exchange request failed: ${error instanceof Error ? error.message : String(error)}`,
            }),
        });

        if (!response.ok) {
          const body = yield* Effect.tryPromise({
            try: () => response.text(),
            catch: () => new TokenExchangeError({ message: 'Failed to read token exchange error response' }),
          });
          return yield* Effect.fail(
            new TokenExchangeError({
              message: `Token exchange failed: ${response.status} ${response.statusText} - ${body}`,
              statusCode: response.status,
            })
          );
        }

        const tokens = yield* Effect.tryPromise({
          try: () =>
            response.json() as Promise<{
              access_token: string;
              refresh_token?: string;
              expires_in?: number;
            }>,
          catch: () => new TokenExchangeError({ message: 'Failed to parse token exchange response' }),
        });

        return tokens;
      });

    const startCallbackServer = (config: OAuthClientConfig, codeChallenge: string, state: string) =>
      Effect.async<{ authCode: string; redirectUri: string }, LoginFlowError>((resume) => {
        const server = http.createServer();
        const redirectPath = '/callback';

        server.listen(0, '127.0.0.1', () => {
          const address = server.address();
          if (!address || typeof address !== 'object') {
            resume(Effect.fail(new LoginFlowError({ message: 'Failed to determine callback server address' })));
            return;
          }

          const port = address.port;
          const redirectUri = `http://127.0.0.1:${port}${redirectPath}`;

          const authUrl = new URL(config.authorizeUrl);
          authUrl.searchParams.append('client_id', config.clientId);
          authUrl.searchParams.append('redirect_uri', redirectUri);
          authUrl.searchParams.append('response_type', 'code');
          authUrl.searchParams.append('scope', config.scope);
          authUrl.searchParams.append('code_challenge', codeChallenge);
          authUrl.searchParams.append('code_challenge_method', 'S256');
          authUrl.searchParams.append('state', state);

          Console.log(`Please open this URL in your browser to log in:\n${authUrl.toString()}\n`).pipe(Effect.runSync);
          Console.log('Waiting for login callback...').pipe(Effect.runSync);
          void open(authUrl.toString());

          server.on('request', (req, res) => {
            const reqUrl = new URL(req.url || '', redirectUri);
            if (reqUrl.pathname !== '/callback') {
              res.writeHead(404).end('Not Found');
              return;
            }

            const authCode = reqUrl.searchParams.get('code');
            const receivedState = reqUrl.searchParams.get('state');
            const oauthError = reqUrl.searchParams.get('error');

            res.writeHead(200, { 'Content-Type': 'text/html', Connection: 'close' });

            if (oauthError) {
              const safeOauthError = escapeHtml(oauthError);
              res.end(`<h1>Login Failed!</h1><p>Error: ${safeOauthError}</p><p>You can close this tab.</p>`);
              server.close();
              resume(Effect.fail(new LoginFlowError({ message: `OAuth error: ${oauthError}` })));
              return;
            }

            if (receivedState !== state) {
              res.end(
                '<h1>Login Failed!</h1><p>State mismatch. Possible CSRF attack.</p><p>You can close this tab.</p>'
              );
              server.close();
              resume(Effect.fail(new LoginFlowError({ message: 'State mismatch' })));
              return;
            }

            if (authCode) {
              res.end('<h1>Login Successful!</h1><p>You can close this tab.</p>');
              server.close();
              resume(Effect.succeed({ authCode, redirectUri }));
            } else {
              res.end('<h1>Login Failed!</h1><p>No authorization code received.</p><p>You can close this tab.</p>');
              server.close();
              resume(Effect.fail(new LoginFlowError({ message: 'No authorization code received' })));
            }
          });

          server.on('error', (err: Error) => {
            resume(Effect.fail(new LoginFlowError({ message: `Local server error: ${err.message}` })));
          });
        });
      });

    const login = Effect.gen(function* () {
      yield* logout;

      const { codeVerifier, codeChallenge } = generatePKCE();
      const state = crypto.randomBytes(16).toString('hex');

      const config = yield* oauthConfig.getConfig;

      const { authCode, redirectUri } = yield* startCallbackServer(config, codeChallenge, state);
      const tokens = yield* exchangeCodeForTokens(config, authCode, redirectUri, codeVerifier);

      accessToken = tokens.access_token;
      tokenExpirationTime = Date.now() + (tokens.expires_in || 3600) * 1000;

      if (!tokens.refresh_token) {
        return yield* Effect.fail(
          new TokenExchangeError({ message: 'No refresh token received from identity provider' })
        );
      }

      yield* storage.save({
        refreshToken: tokens.refresh_token,
        accessToken,
        tokenExpirationTime,
      });

      yield* Effect.log('Login successful');
      return true as const;
    });

    const refreshAccessToken: Effect.Effect<true, TokenRefreshError> = Effect.gen(function* () {
      const stored: Option.Option<StoredAuthData> = yield* storage.load.pipe(
        Effect.catchTag('AuthStorageReadError', (err) => Effect.fail(new TokenRefreshError({ message: err.message })))
      );
      const config = yield* oauthConfig.getConfig.pipe(
        Effect.catchTag('OAuthDiscoveryError', (err) => Effect.fail(new TokenRefreshError({ message: err.message })))
      );

      const authData: StoredAuthData = yield* Option.match(stored, {
        onNone: () => Effect.fail(new TokenRefreshError({ message: 'No refresh token available. Please log in.' })),
        onSome: (data: StoredAuthData) =>
          data.refreshToken
            ? Effect.succeed(data)
            : Effect.fail(new TokenRefreshError({ message: 'No refresh token available. Please log in.' })),
      });

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(config.tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              client_id: config.clientId,
              refresh_token: authData.refreshToken,
            }).toString(),
          }),
        catch: (error) =>
          new TokenRefreshError({
            message: `Token refresh request failed: ${error instanceof Error ? error.message : String(error)}`,
          }),
      });

      if (!response.ok) {
        if (response.status === 400) {
          yield* logout.pipe(Effect.catchAll(() => Effect.void));
          return yield* Effect.fail(
            new TokenRefreshError({
              message: 'Refresh token is invalid or expired. Please log in again.',
              statusCode: response.status,
            })
          );
        }
        const body = yield* Effect.tryPromise({
          try: () => response.text(),
          catch: () => new TokenRefreshError({ message: 'Failed to read refresh error response' }),
        });
        return yield* Effect.fail(
          new TokenRefreshError({
            message: `Token refresh failed: ${response.status} ${response.statusText} - ${body}`,
            statusCode: response.status,
          })
        );
      }

      const tokens = yield* Effect.tryPromise({
        try: () => response.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number }>,
        catch: () => new TokenRefreshError({ message: 'Failed to parse token refresh response' }),
      });

      accessToken = tokens.access_token;
      tokenExpirationTime = Date.now() + (tokens.expires_in || 3600) * 1000;
      const newRefreshToken = tokens.refresh_token || authData.refreshToken;

      yield* storage
        .save({
          refreshToken: newRefreshToken,
          accessToken,
          tokenExpirationTime,
        })
        .pipe(Effect.catchAll(() => Effect.void));

      yield* Effect.log('Access token refreshed successfully');
      return true as const;
    });

    const getAccessToken = Effect.gen(function* () {
      // Check in-memory cache
      if (accessToken && Date.now() < tokenExpirationTime) {
        return accessToken;
      }

      // Try to load from storage
      const stored: Option.Option<StoredAuthData> = yield* storage.load.pipe(
        Effect.catchAll(() => Effect.succeed(Option.none<StoredAuthData>()))
      );
      Option.match(stored, {
        onNone: () => {},
        onSome: (data: StoredAuthData) => {
          if (data.accessToken && data.tokenExpirationTime && Date.now() < data.tokenExpirationTime) {
            accessToken = data.accessToken;
            tokenExpirationTime = data.tokenExpirationTime;
          }
        },
      });

      if (accessToken && Date.now() < tokenExpirationTime) {
        return accessToken;
      }

      // Try refresh
      yield* Effect.log('Access token expired or not available. Attempting to refresh...');
      yield* refreshAccessToken.pipe(
        Effect.catchTag('TokenRefreshError', (err) => Effect.fail(new NotAuthenticatedError({ message: err.message })))
      );

      if (!accessToken) {
        return yield* Effect.fail(
          new NotAuthenticatedError({ message: 'No valid access token available. Please log in first.' })
        );
      }

      return accessToken;
    });

    const getUserInfo = Effect.gen(function* () {
      const config = yield* oauthConfig.getConfig;
      const token = yield* getAccessToken;

      const fetchUserInfo = (t: string) =>
        Effect.tryPromise({
          try: () =>
            fetch(config.userinfoUrl, {
              headers: {
                Authorization: `Bearer ${t}`,
                Accept: 'application/json',
              },
            }),
          catch: (error) =>
            new UserInfoFetchError({
              message: `Failed to fetch user info: ${error instanceof Error ? error.message : String(error)}`,
            }),
        });

      let response = yield* fetchUserInfo(token);

      // Retry once on 401/403
      if (response.status === 401 || response.status === 403) {
        yield* refreshAccessToken.pipe(
          Effect.catchTag('TokenRefreshError', (err) => Effect.fail(new UserInfoFetchError({ message: err.message })))
        );
        if (!accessToken) {
          return yield* Effect.fail(new UserInfoFetchError({ message: 'Token refresh failed' }));
        }
        response = yield* fetchUserInfo(accessToken);
      }

      if (!response.ok) {
        const body = yield* Effect.tryPromise({
          try: () => response.text(),
          catch: () => new UserInfoFetchError({ message: 'Failed to read user info error response' }),
        });
        return yield* Effect.fail(
          new UserInfoFetchError({
            message: `Failed to fetch user info: ${response.status} ${response.statusText}${body ? ` - ${body}` : ''}`,
            statusCode: response.status,
          })
        );
      }

      const data = yield* Effect.tryPromise({
        try: () => response.json() as Promise<Record<string, unknown>>,
        catch: () => new UserInfoFetchError({ message: 'Failed to parse user info response' }),
      });

      return data;
    });

    const inferUserName = (info: Record<string, unknown>): string => {
      const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

      const name = info.name;
      const givenName = info.given_name;
      const familyName = info.family_name;
      const preferredUsername = info.preferred_username;
      const email = info.email;

      return (
        (isNonEmptyString(name) && name) ||
        (isNonEmptyString(givenName) && isNonEmptyString(familyName) ? `${givenName} ${familyName}` : undefined) ||
        (isNonEmptyString(preferredUsername) && preferredUsername) ||
        (isNonEmptyString(email) && email) ||
        'your account'
      );
    };

    return { login, logout, getAccessToken, getUserInfo, refreshAccessToken, inferUserName };
  }),
}) {}

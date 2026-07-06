import { Console, Duration, Effect, Option, Schema } from 'effect';
import process from 'node:process';
import open from 'open';
import { DeviceAuthorizationResponse, type OAuthClientConfig, type StoredAuthData } from '../domain';
import {
  AuthorizationDeniedError,
  DeviceAuthorizationError,
  DeviceCodeExpiredError,
  LoginFlowError,
  NotAuthenticatedError,
  TokenExchangeError,
  TokenRefreshError,
  UserInfoFetchError,
} from '../errors';
import { writeClipboard } from '../lib/clipboard';
import { AuthStorageService } from './auth-storage';
import { OAuthConfigService } from './oauth-config';

/** Grant type identifier for the OAuth 2.0 Device Authorization Grant (RFC 8628). */
const DEVICE_CODE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';

/** Fallback poll interval (seconds) when the provider omits `interval`. */
const DEFAULT_POLL_INTERVAL_SECONDS = 5;

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

    // Step 1 (RFC 8628 §3.1): request a device_code / user_code pair.
    const requestDeviceAuthorization = (config: OAuthClientConfig) =>
      Effect.gen(function* () {
        const response = yield* Effect.tryPromise({
          try: (signal) =>
            fetch(config.deviceAuthorizeUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ client_id: config.clientId, scope: config.scope }).toString(),
              signal,
            }),
          catch: (error) =>
            new DeviceAuthorizationError({
              message: `Device authorization request failed: ${error instanceof Error ? error.message : String(error)}`,
            }),
        });

        if (!response.ok) {
          const body = yield* Effect.tryPromise({
            try: () => response.text(),
            catch: () =>
              new DeviceAuthorizationError({ message: 'Failed to read device authorization error response' }),
          });
          return yield* Effect.fail(
            new DeviceAuthorizationError({
              message: `Device authorization failed: ${response.status} ${response.statusText} - ${body}`,
            })
          );
        }

        const json = yield* Effect.tryPromise({
          try: () => response.json(),
          catch: () => new DeviceAuthorizationError({ message: 'Failed to parse device authorization response' }),
        });

        return yield* Schema.decodeUnknown(DeviceAuthorizationResponse)(json).pipe(
          Effect.mapError(
            () => new DeviceAuthorizationError({ message: 'Invalid device authorization response schema' })
          )
        );
      });

    // A single poll of the token endpoint (RFC 8628 §3.4). Translates the RFC 8628
    // §3.5 poll errors into control-flow values; any other failure is fatal.
    const pollTokenOnce = (config: OAuthClientConfig, deviceCode: string) =>
      Effect.gen(function* () {
        const response = yield* Effect.tryPromise({
          try: (signal) =>
            fetch(config.tokenUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type: DEVICE_CODE_GRANT_TYPE,
                client_id: config.clientId,
                device_code: deviceCode,
              }).toString(),
              signal,
            }),
          catch: (error) =>
            new TokenExchangeError({
              message: `Token poll request failed: ${error instanceof Error ? error.message : String(error)}`,
            }),
        });

        if (response.ok) {
          const tokens = yield* Effect.tryPromise({
            try: () =>
              response.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number }>,
            catch: () => new TokenExchangeError({ message: 'Failed to parse token response' }),
          });
          return { kind: 'tokens', tokens } as const;
        }

        const errorBody = yield* Effect.tryPromise({
          try: () => response.json() as Promise<{ error?: string }>,
          catch: () => new TokenExchangeError({ message: 'Failed to parse token poll error response' }),
        });

        switch (errorBody.error) {
          case 'authorization_pending':
            return { kind: 'pending' } as const;
          case 'slow_down':
            return { kind: 'slow_down' } as const;
          case 'access_denied':
            return { kind: 'denied' } as const;
          case 'expired_token':
            return { kind: 'expired' } as const;
          default:
            return yield* Effect.fail(
              new TokenExchangeError({
                message: `Token poll failed: ${response.status} ${response.statusText} - ${errorBody.error ?? 'unknown_error'}`,
                statusCode: response.status,
              })
            );
        }
      });

    // Step 2 (RFC 8628 §3.4–3.5): poll until approval, denial, or expiry.
    const pollForToken = (config: OAuthClientConfig, device: DeviceAuthorizationResponse) =>
      Effect.gen(function* () {
        const deadline = Date.now() + device.expires_in * 1000;
        let interval = device.interval ?? DEFAULT_POLL_INTERVAL_SECONDS;

        while (true) {
          yield* Effect.sleep(Duration.seconds(interval));

          if (Date.now() >= deadline) {
            return yield* Effect.fail(
              new DeviceCodeExpiredError({
                message: 'The login code expired before it was approved. Please run `gigadrive login` again.',
              })
            );
          }

          const result = yield* pollTokenOnce(config, device.device_code);
          switch (result.kind) {
            case 'tokens':
              return result.tokens;
            case 'pending':
              continue;
            case 'slow_down':
              // RFC 8628 §3.5: back off by 5 seconds on slow_down.
              interval += 5;
              continue;
            case 'denied':
              return yield* Effect.fail(new AuthorizationDeniedError({ message: 'The login request was denied.' }));
            case 'expired':
              return yield* Effect.fail(
                new DeviceCodeExpiredError({
                  message: 'The login code expired before it was approved. Please run `gigadrive login` again.',
                })
              );
          }
        }
      });

    // Runs alongside polling in a TTY: lets the user press "c" to copy the URL
    // (Claude-Code style) and Ctrl+C to cancel. Never completes on its own — the
    // poll loop wins the race and interrupts this, restoring the terminal.
    const watchCopyKey = (url: string) =>
      Effect.async<never, LoginFlowError>((resume) => {
        const stdin = process.stdin;
        if (!stdin.isTTY) {
          // Not interactive: nothing to listen for; wait to be interrupted.
          return;
        }

        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');

        const onData = (key: string) => {
          if (key === 'c' || key === 'C') {
            writeClipboard(url);
            // runSync inside a raw Node callback — a deliberate, localized exception.
            Console.log('Copied the login URL to your clipboard.').pipe(Effect.runSync);
          } else if (key === '\u0003') {
            // Ctrl+C: raw mode suppresses SIGINT, so handle cancellation explicitly.
            resume(Effect.fail(new LoginFlowError({ message: 'Login canceled.' })));
          }
        };

        stdin.on('data', onData);

        return Effect.sync(() => {
          stdin.off('data', onData);
          if (stdin.isTTY) stdin.setRawMode(false);
          stdin.pause();
        });
      });

    const login = Effect.gen(function* () {
      yield* logout;

      const config = yield* oauthConfig.getConfig;
      const device = yield* requestDeviceAuthorization(config);

      const verificationUri = device.verification_uri;
      const verificationUriComplete = device.verification_uri_complete ?? verificationUri;
      const interactive = process.stdin.isTTY === true;

      yield* Console.log(
        `\nTo sign in, visit:\n\n    ${verificationUri}\n\nand enter the code:\n\n    ${device.user_code}\n`
      );

      if (interactive) {
        yield* Effect.sync(() => {
          void open(verificationUriComplete);
        });
        yield* Console.log('We tried to open your browser automatically. If it did not open, use the URL above.');
        yield* Console.log('Press "c" to copy the URL to your clipboard, or Ctrl+C to cancel.');
      }

      yield* Console.log('\nWaiting for you to approve the login…');

      const poll = pollForToken(config, device);
      const tokens = yield* interactive ? poll.pipe(Effect.race(watchCopyKey(verificationUriComplete))) : poll;

      if (!tokens.refresh_token) {
        return yield* Effect.fail(
          new TokenExchangeError({ message: 'No refresh token received from identity provider' })
        );
      }

      accessToken = tokens.access_token;
      tokenExpirationTime = Date.now() + (tokens.expires_in || 3600) * 1000;

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

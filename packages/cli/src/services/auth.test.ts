import { FileSystem, Path } from '@effect/platform';
import { Effect, Layer, Logger, LogLevel, Option } from 'effect';
import * as os from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OAuthClientConfig, StoredAuthData } from '../domain';
import { AuthService } from './auth';
import { AuthStorageService } from './auth-storage';
import { OAuthConfigService } from './oauth-config';

// ---------------------------------------------------------------------------
// AuthService tests — inferUserName + getAccessToken
//
// AuthService.Default depends on:
//   OAuthConfigService.Default (needs Config.* -> ConfigProvider)
//   AuthStorageService.Default (needs FileSystem + Path)
//
// We provide mock layers for all transitive dependencies.
// ---------------------------------------------------------------------------

const HOMEDIR = os.homedir();

const makeMockAuthStorage = (stored: Option.Option<StoredAuthData>) => {
  const files = new Map<string, string>();
  if (Option.isSome(stored)) {
    files.set(`${HOMEDIR}/.gigadrive/auth.json`, JSON.stringify(stored.value));
  }

  const mockFs = {
    exists: (path: string) => Effect.succeed(files.has(path)),
    readFileString: (path: string) =>
      files.has(path)
        ? Effect.succeed(files.get(path)!)
        : Effect.fail({ _tag: 'SystemError' as const, message: 'ENOENT' }),
    writeFileString: (path: string, content: string) =>
      Effect.sync(() => {
        files.set(path, content);
      }),
    remove: (path: string) =>
      Effect.sync(() => {
        files.delete(path);
      }),
    makeDirectory: () => Effect.void,
    chmod: () => Effect.void,
  } as unknown as FileSystem.FileSystem;

  const mockPath = {
    join: (...segments: string[]) => segments.join('/'),
  } as unknown as Path.Path;

  return Layer.mergeAll(Layer.succeed(FileSystem.FileSystem, mockFs), Layer.succeed(Path.Path, mockPath));
};

const makeAuthTestLayer = (stored: Option.Option<StoredAuthData>) => {
  // Provide platform layer for AuthStorageService.Default
  const platformLayer = makeMockAuthStorage(stored);

  // Provide a mock OAuthConfigService directly (avoids OIDC discovery fetch)
  const mockOAuthConfig = Layer.succeed(OAuthConfigService, {
    getConfig: Effect.succeed({
      clientId: 'test-client-id',
      issuer: 'https://idp.example.com',
      authorizeUrl: 'https://idp.example.com/authorize',
      tokenUrl: 'https://idp.example.com/token',
      deviceAuthorizeUrl: 'https://idp.example.com/device_authorization',
      scope: 'openid profile email',
      userinfoUrl: 'https://idp.example.com/userinfo',
    } satisfies OAuthClientConfig),
  });

  // Build: AuthStorageService from platform layer, OAuthConfig from mock, then AuthService
  const authStorageLive = Layer.provide(AuthStorageService.Default, platformLayer);
  const depsLayer = Layer.mergeAll(mockOAuthConfig, authStorageLive);

  return Layer.provide(AuthService.Default, depsLayer).pipe(Layer.provideMerge(Logger.minimumLogLevel(LogLevel.None)));
};

// ---------------------------------------------------------------------------
// inferUserName
// ---------------------------------------------------------------------------

describe('AuthService.inferUserName', () => {
  const TestLayer = makeAuthTestLayer(Option.none());

  const runEffect = <A, E>(effect: Effect.Effect<A, E, AuthService>) =>
    Effect.runPromise(Effect.provide(effect, TestLayer));

  it('should return name when present', async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const auth = yield* AuthService;
        return auth.inferUserName({ name: 'John Doe' });
      })
    );
    expect(result).toBe('John Doe');
  });

  it('should return given_name + family_name when name is absent', async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const auth = yield* AuthService;
        return auth.inferUserName({ given_name: 'Jane', family_name: 'Smith' });
      })
    );
    expect(result).toBe('Jane Smith');
  });

  it('should return preferred_username when name fields are absent', async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const auth = yield* AuthService;
        return auth.inferUserName({ preferred_username: 'jdoe42' });
      })
    );
    expect(result).toBe('jdoe42');
  });

  it('should return email when other fields are absent', async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const auth = yield* AuthService;
        return auth.inferUserName({ email: 'john@example.com' });
      })
    );
    expect(result).toBe('john@example.com');
  });

  it('should return "your account" when no fields are present', async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const auth = yield* AuthService;
        return auth.inferUserName({});
      })
    );
    expect(result).toBe('your account');
  });

  it('should skip empty string fields', async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const auth = yield* AuthService;
        return auth.inferUserName({ name: '', preferred_username: '  ', email: 'john@example.com' });
      })
    );
    expect(result).toBe('john@example.com');
  });

  it('should prefer name over given_name + family_name', async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const auth = yield* AuthService;
        return auth.inferUserName({ name: 'Full Name', given_name: 'First', family_name: 'Last' });
      })
    );
    expect(result).toBe('Full Name');
  });

  it('should prefer given_name + family_name over preferred_username', async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const auth = yield* AuthService;
        return auth.inferUserName({
          given_name: 'First',
          family_name: 'Last',
          preferred_username: 'username',
          email: 'email@test.com',
        });
      })
    );
    expect(result).toBe('First Last');
  });

  it('should require both given_name and family_name', async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const auth = yield* AuthService;
        return auth.inferUserName({ given_name: 'First', email: 'email@test.com' });
      })
    );
    expect(result).toBe('email@test.com');
  });
});

// ---------------------------------------------------------------------------
// getAccessToken
// ---------------------------------------------------------------------------

describe('AuthService.getAccessToken', () => {
  it('should fail with NotAuthenticatedError when no stored data and no refresh token', async () => {
    const testLayer = makeAuthTestLayer(Option.none());

    const result = await Effect.runPromise(
      Effect.provide(AuthService.getAccessToken, testLayer).pipe(
        Effect.catchTag('NotAuthenticatedError', (err) =>
          Effect.succeed({ _tag: 'caught' as const, message: err.message })
        )
      )
    );

    expect(result).toMatchObject({ _tag: 'caught' });
  });

  it('should return cached access token from stored data when not expired', async () => {
    const futureExpiration = Date.now() + 3600_000;

    const testLayer = makeAuthTestLayer(
      Option.some<StoredAuthData>({
        refreshToken: 'rt-123',
        accessToken: 'stored-access-token',
        tokenExpirationTime: futureExpiration,
      })
    );

    const token = await Effect.runPromise(Effect.provide(AuthService.getAccessToken, testLayer));
    expect(token).toBe('stored-access-token');
  });
});

// ---------------------------------------------------------------------------
// login — Device Authorization Grant (RFC 8628)
//
// process.stdin.isTTY is undefined under vitest, so login runs the headless
// path (no browser open, no keypress listener). We mock global fetch to drive
// the device-authorization request and the token poll, using interval=0 so the
// poll loop does not wait between attempts.
// ---------------------------------------------------------------------------

const jsonResponse = (status: number, body: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Bad Request',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  }) as unknown as Response;

const deviceAuthorizationBody = {
  device_code: 'dev-code-abc',
  user_code: 'WXYZ-1234',
  verification_uri: 'https://idp.example.com/device',
  verification_uri_complete: 'https://idp.example.com/device?user_code=WXYZ-1234',
  expires_in: 300,
  interval: 0,
};

const discoveryBody = {
  issuer: 'https://idp.example.com',
  authorization_endpoint: 'https://idp.example.com/authorize',
  token_endpoint: 'https://idp.example.com/token',
  userinfo_endpoint: 'https://idp.example.com/userinfo',
  device_authorization_endpoint: 'https://idp.example.com/device_authorization',
};

/**
 * Mocks global fetch: OIDC discovery returns the endpoints (the real
 * OAuthConfigService baked into AuthService.Default resolves through it),
 * device_authorization returns the code pair, and token returns the queued
 * responses in order.
 */
const stubFetch = (tokenResponses: Response[]) => {
  let tokenCall = 0;
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/.well-known/openid-configuration')) {
      return Promise.resolve(jsonResponse(200, discoveryBody));
    }
    if (url.endsWith('/device_authorization')) {
      return Promise.resolve(jsonResponse(200, deviceAuthorizationBody));
    }
    if (url.endsWith('/token')) {
      const response = tokenResponses[Math.min(tokenCall, tokenResponses.length - 1)];
      tokenCall += 1;
      return Promise.resolve(response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('AuthService.login (device flow)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('polls through authorization_pending and stores tokens on approval', async () => {
    const fetchMock = stubFetch([
      jsonResponse(400, { error: 'authorization_pending' }),
      jsonResponse(200, {
        access_token: 'device-access-token',
        refresh_token: 'device-refresh-token',
        expires_in: 3600,
      }),
    ]);

    const testLayer = makeAuthTestLayer(Option.none());

    const token = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const auth = yield* AuthService;
          yield* auth.login;
          return yield* auth.getAccessToken;
        }),
        testLayer
      )
    );

    expect(token).toBe('device-access-token');
    const deviceCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/device_authorization'));
    expect(deviceCall).toBeDefined();
    // 2 token polls: authorization_pending, then success.
    const tokenCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/token'));
    expect(tokenCalls).toHaveLength(2);
  });

  it('fails with AuthorizationDeniedError when the user denies', async () => {
    stubFetch([jsonResponse(400, { error: 'access_denied' })]);

    const testLayer = makeAuthTestLayer(Option.none());

    const result = await Effect.runPromise(
      Effect.provide(AuthService.login, testLayer).pipe(
        Effect.catchTag('AuthorizationDeniedError', (err) =>
          Effect.succeed({ _tag: 'denied' as const, message: err.message })
        )
      )
    );

    expect(result).toMatchObject({ _tag: 'denied' });
  });

  it('fails with DeviceCodeExpiredError when the code expires', async () => {
    stubFetch([jsonResponse(400, { error: 'expired_token' })]);

    const testLayer = makeAuthTestLayer(Option.none());

    const result = await Effect.runPromise(
      Effect.provide(AuthService.login, testLayer).pipe(
        Effect.catchTag('DeviceCodeExpiredError', (err) =>
          Effect.succeed({ _tag: 'expired' as const, message: err.message })
        )
      )
    );

    expect(result).toMatchObject({ _tag: 'expired' });
  });

  it('fails with TokenExchangeError when no refresh token is returned', async () => {
    stubFetch([jsonResponse(200, { access_token: 'device-access-token', expires_in: 3600 })]);

    const testLayer = makeAuthTestLayer(Option.none());

    const result = await Effect.runPromise(
      Effect.provide(AuthService.login, testLayer).pipe(
        Effect.catchTag('TokenExchangeError', (err) =>
          Effect.succeed({ _tag: 'no-refresh' as const, message: err.message })
        )
      )
    );

    expect(result).toMatchObject({ _tag: 'no-refresh' });
  });

  // Regression for the interactive race: `watchCopyKey` never completes on its own,
  // so plain `Effect.race` (which waits for a *success*) would hang when the poll
  // fails. `raceFirst` must let the denial settle. Forces the TTY path so the
  // copy-key watcher participates; the test hanging here would mean the bug is back.
  it('settles (does not hang) in the interactive TTY path when the request is denied', async () => {
    stubFetch([jsonResponse(400, { error: 'access_denied' })]);

    const stdin = process.stdin as unknown as Record<string, unknown>;
    const saved = {
      isTTY: stdin.isTTY,
      setRawMode: stdin.setRawMode,
      resume: stdin.resume,
      setEncoding: stdin.setEncoding,
      pause: stdin.pause,
    };
    stdin.isTTY = true;
    stdin.setRawMode = () => process.stdin;
    stdin.resume = () => process.stdin;
    stdin.setEncoding = () => process.stdin;
    stdin.pause = () => process.stdin;

    try {
      const testLayer = makeAuthTestLayer(Option.none());
      const result = await Effect.runPromise(
        Effect.provide(AuthService.login, testLayer).pipe(
          Effect.catchTag('AuthorizationDeniedError', () => Effect.succeed({ _tag: 'denied' as const }))
        )
      );
      expect(result).toMatchObject({ _tag: 'denied' });
    } finally {
      Object.assign(stdin, saved);
    }
  });
});

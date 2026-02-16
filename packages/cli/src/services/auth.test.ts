import { FileSystem, Path } from '@effect/platform';
import { Effect, Layer, Logger, LogLevel, Option } from 'effect';
import * as os from 'node:os';
import { describe, expect, it } from 'vitest';
import type { OAuthClientConfig, StoredAuthData } from '../domain';
import { AuthService, base64URLEncode, generatePKCE } from './auth';
import { AuthStorageService } from './auth-storage';
import { OAuthConfigService } from './oauth-config';

// ---------------------------------------------------------------------------
// Pure function tests — base64URLEncode
// ---------------------------------------------------------------------------

describe('base64URLEncode', () => {
  it('should produce a URL-safe base64 string', () => {
    const buffer = Buffer.from('hello world');
    const result = base64URLEncode(buffer);

    expect(result).not.toContain('+');
    expect(result).not.toContain('/');
    expect(result).not.toContain('=');
  });

  it('should encode an empty buffer', () => {
    const result = base64URLEncode(Buffer.alloc(0));
    expect(result).toBe('');
  });

  it('should encode known bytes correctly', () => {
    // Base64 of [0xFF, 0xFF] is "//8=" -> URL-safe: "__8"
    const buffer = Buffer.from([0xff, 0xff]);
    const result = base64URLEncode(buffer);
    expect(result).toBe('__8');
  });

  it('should replace + with - and / with _', () => {
    const buffer = Buffer.from([0x3e, 0x3f]);
    const standard = buffer.toString('base64');
    const urlSafe = base64URLEncode(buffer);
    expect(urlSafe).toBe(standard.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''));
  });
});

// ---------------------------------------------------------------------------
// Pure function tests — generatePKCE
// ---------------------------------------------------------------------------

describe('generatePKCE', () => {
  it('should return codeVerifier and codeChallenge', () => {
    const { codeVerifier, codeChallenge } = generatePKCE();
    expect(typeof codeVerifier).toBe('string');
    expect(typeof codeChallenge).toBe('string');
    expect(codeVerifier.length).toBeGreaterThan(0);
    expect(codeChallenge.length).toBeGreaterThan(0);
  });

  it('should produce URL-safe strings', () => {
    const { codeVerifier, codeChallenge } = generatePKCE();
    for (const str of [codeVerifier, codeChallenge]) {
      expect(str).not.toContain('+');
      expect(str).not.toContain('/');
      expect(str).not.toContain('=');
    }
  });

  it('should produce unique values on each call', () => {
    const first = generatePKCE();
    const second = generatePKCE();
    expect(first.codeVerifier).not.toBe(second.codeVerifier);
    expect(first.codeChallenge).not.toBe(second.codeChallenge);
  });

  it('codeChallenge should be a SHA-256 hash of codeVerifier', () => {
    const { codeVerifier, codeChallenge } = generatePKCE();
    // SHA-256 = 32 bytes = 43 base64url chars without padding
    expect(codeChallenge.length).toBe(43);
    // codeVerifier is from 64 random bytes = 86 base64url chars
    expect(codeVerifier.length).toBe(86);
  });
});

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

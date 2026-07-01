import { ConfigProvider, Effect, Layer, Logger, LogLevel } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotAuthenticatedError } from '../errors';
import { ApiClientService } from './api-client';
import { AuthService } from './auth';

const BASE_URL = 'https://api.example.com';

type AuthOverrides = { getAccessToken?: AuthService['getAccessToken'] };

const makeTestLayer = (auth: AuthOverrides = {}) => {
  const configLayer = Layer.setConfigProvider(ConfigProvider.fromMap(new Map([['GIGADRIVE_API_BASE_URL', BASE_URL]])));

  const mockAuthService = Layer.succeed(AuthService, {
    login: Effect.succeed(true as const),
    logout: Effect.void,
    getAccessToken: auth.getAccessToken ?? Effect.succeed('test-auth-token'),
    getUserInfo: Effect.succeed({}),
    refreshAccessToken: Effect.succeed(true as const),
    inferUserName: () => 'test-user',
    _tag: 'AuthService',
  } as unknown as AuthService);

  return Layer.provide(ApiClientService.Default, Layer.mergeAll(configLayer, mockAuthService)).pipe(
    Layer.provideMerge(Logger.minimumLogLevel(LogLevel.None))
  );
};

const lastFetchCall = () => {
  const calls = vi.mocked(globalThis.fetch).mock.calls;
  const [url, init] = calls[calls.length - 1]!;
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries((init?.headers ?? {}) as Record<string, string>)) {
    headers[key.toLowerCase()] = value;
  }
  return { url: String(url), method: init?.method, headers };
};

const listApps = Effect.gen(function* () {
  const client = yield* ApiClientService;
  return yield* client.request((c) => c.applications.list());
});

describe('ApiClientService', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('authenticates requests with a bearer token and the configured base URL', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 }));

    const result = await Effect.runPromise(Effect.provide(listApps, makeTestLayer()));

    expect(result.total).toBe(0);
    const call = lastFetchCall();
    expect(call.url).toBe(`${BASE_URL}/applications`);
    expect(call.method).toBe('GET');
    expect(call.headers.authorization).toBe('Bearer test-auth-token');
  });

  it('maps a non-OK response to ApiRequestError with the status code', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'boom' }), { status: 500 }));

    const result = await Effect.runPromise(
      Effect.provide(listApps, makeTestLayer()).pipe(
        Effect.catchTag('ApiRequestError', (err) => Effect.succeed({ status: err.statusCode, message: err.message }))
      )
    );

    expect(result).toMatchObject({ status: 500, message: 'boom' });
  });

  it('propagates NotAuthenticatedError when the user is not logged in', async () => {
    globalThis.fetch = vi.fn();

    const layer = makeTestLayer({
      getAccessToken: Effect.fail(new NotAuthenticatedError({ message: 'please log in' })),
    });

    const result = await Effect.runPromise(
      Effect.provide(listApps, layer).pipe(
        Effect.catchTag('NotAuthenticatedError', (err) =>
          Effect.succeed({ _tag: 'caught' as const, message: err.message })
        )
      )
    );

    expect(result).toMatchObject({ _tag: 'caught', message: 'please log in' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

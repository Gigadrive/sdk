import { FileSystem, Path } from '@effect/platform';
import { ConfigProvider, Effect, Layer, Logger, LogLevel } from 'effect';
import * as os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth';
import { LocalCredentialsService } from './local-credentials';

const BASE_URL = 'https://api.example.com';
const STORE_FILE = `${os.homedir()}/.gigadrive/dev-keys.json`;

const CREATED_KEY = {
  id: 'newkey',
  name: 'cli-dev',
  applicationId: 'app-1',
  scopes: ['network:env_vars:read'],
  expiresAt: null,
  createdAt: '2026-07-03T00:00:00.000Z',
  updatedAt: '2026-07-03T00:00:00.000Z',
  secret: 'gdnet_secret_new',
};

const makeFetch = (opts?: { deleteStatus?: number }) =>
  vi.fn((input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (method === 'POST' && url.endsWith('/api-keys')) {
      return Promise.resolve(
        new Response(JSON.stringify(CREATED_KEY), { status: 200, headers: { 'content-type': 'application/json' } })
      );
    }
    if (method === 'DELETE' && url.includes('/api-keys/')) {
      return Promise.resolve(new Response(null, { status: opts?.deleteStatus ?? 204 }));
    }
    return Promise.resolve(new Response('not found', { status: 404 }));
  });

const makeMockFs = (files: Map<string, string>) =>
  ({
    exists: (path: string) => Effect.succeed(files.has(path)),
    readFileString: (path: string) =>
      files.has(path)
        ? Effect.succeed(files.get(path)!)
        : Effect.fail({ _tag: 'SystemError' as const, message: 'ENOENT' }),
    writeFileString: (path: string, content: string) =>
      Effect.sync(() => {
        files.set(path, content);
      }),
    makeDirectory: () => Effect.void,
    chmod: () => Effect.void,
  }) as unknown as FileSystem.FileSystem;

const mockPath: Path.Path = {
  join: (...segments: string[]) => segments.join('/'),
} as unknown as Path.Path;

const mockAuth = Layer.succeed(AuthService, {
  login: Effect.succeed(true as const),
  logout: Effect.void,
  getAccessToken: Effect.succeed('test-auth-token'),
  getUserInfo: Effect.succeed({}),
  refreshAccessToken: Effect.succeed(true as const),
  inferUserName: () => 'test-user',
  _tag: 'AuthService',
} as unknown as AuthService);

const makeLayer = (initialFiles: Record<string, string> = {}) => {
  const files = new Map(Object.entries(initialFiles));
  const platform = Layer.mergeAll(
    Layer.succeed(FileSystem.FileSystem, makeMockFs(files)),
    Layer.succeed(Path.Path, mockPath)
  );
  const config = Layer.setConfigProvider(ConfigProvider.fromMap(new Map([['GIGADRIVE_API_BASE_URL', BASE_URL]])));
  const layer = Layer.provide(LocalCredentialsService.Default, Layer.mergeAll(config, mockAuth, platform)).pipe(
    Layer.provideMerge(Logger.minimumLogLevel(LogLevel.None))
  );
  return { layer, files };
};

const fetchCalls = () =>
  vi
    .mocked(globalThis.fetch)
    .mock.calls.map((c) => `${(c[1] as RequestInit | undefined)?.method ?? 'GET'} ${String(c[0])}`);

describe('LocalCredentialsService.provision', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('mints a key on the first run and stores its ID', async () => {
    globalThis.fetch = makeFetch();
    const { layer, files } = makeLayer();

    const entries = await Effect.runPromise(
      Effect.provide(LocalCredentialsService.provision({ applicationId: 'app-1', rotate: false }), layer)
    );

    expect(entries).toContainEqual({ key: 'GIGADRIVE_CLIENT_ID', value: 'newkey' });
    expect(entries).toContainEqual({ key: 'GIGADRIVE_CLIENT_SECRET', value: 'gdnet_secret_new' });
    expect(entries).toContainEqual({ key: 'GIGADRIVE_API_BASE_URL', value: BASE_URL });
    expect(files.get(STORE_FILE)).toContain('newkey');
    expect(fetchCalls().filter((c) => c.startsWith('POST'))).toHaveLength(1);
    expect(fetchCalls().some((c) => c.startsWith('DELETE'))).toBe(false);
  });

  it('rotates by revoking the previous key and minting a new one', async () => {
    globalThis.fetch = makeFetch();
    const { layer } = makeLayer({ [STORE_FILE]: JSON.stringify({ 'app-1': { apiKeyId: 'oldkey' } }) });

    await Effect.runPromise(
      Effect.provide(LocalCredentialsService.provision({ applicationId: 'app-1', rotate: true }), layer)
    );

    const calls = fetchCalls();
    expect(calls.some((c) => c.startsWith('DELETE') && c.includes('/api-keys/oldkey'))).toBe(true);
    expect(calls.some((c) => c.startsWith('POST') && c.endsWith('/api-keys'))).toBe(true);
  });

  it('tolerates a 404 when revoking a key that no longer exists', async () => {
    globalThis.fetch = makeFetch({ deleteStatus: 404 });
    const { layer } = makeLayer({ [STORE_FILE]: JSON.stringify({ 'app-1': { apiKeyId: 'oldkey' } }) });

    const entries = await Effect.runPromise(
      Effect.provide(LocalCredentialsService.provision({ applicationId: 'app-1', rotate: true }), layer)
    );
    expect(entries).toContainEqual({ key: 'GIGADRIVE_CLIENT_ID', value: 'newkey' });
  });

  it('reuses existing credentials when they match the stored key and rotate is off', async () => {
    globalThis.fetch = makeFetch();
    const { layer } = makeLayer({ [STORE_FILE]: JSON.stringify({ 'app-1': { apiKeyId: 'oldkey' } }) });
    const existingContent = 'GIGADRIVE_CLIENT_ID=oldkey\nGIGADRIVE_CLIENT_SECRET=gdnet_secret_old\n';

    const entries = await Effect.runPromise(
      Effect.provide(
        LocalCredentialsService.provision({ applicationId: 'app-1', rotate: false, existingContent }),
        layer
      )
    );

    expect(entries).toContainEqual({ key: 'GIGADRIVE_CLIENT_ID', value: 'oldkey' });
    expect(entries).toContainEqual({ key: 'GIGADRIVE_CLIENT_SECRET', value: 'gdnet_secret_old' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

import { FileSystem, Path } from '@effect/platform';
import { Effect, Layer, Logger, LogLevel, Option } from 'effect';
import * as os from 'node:os';
import { describe, expect, it } from 'vitest';
import type { StoredAuthData } from '../domain';
import { AuthStorageService } from './auth-storage';

const HOMEDIR = os.homedir();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeMockFileSystem = (state: {
  files?: Record<string, string>;
  failOnRead?: boolean;
  failOnWrite?: boolean;
  failOnExists?: boolean;
  failOnRemove?: boolean;
}) => {
  const files = new Map<string, string>(Object.entries(state.files ?? {}));

  return {
    exists: (path: string) =>
      state.failOnExists
        ? Effect.fail({ _tag: 'SystemError' as const, message: 'Permission denied' })
        : Effect.succeed(files.has(path)),

    readFileString: (path: string) =>
      state.failOnRead
        ? Effect.fail({ _tag: 'SystemError' as const, message: 'Read failed' })
        : files.has(path)
          ? Effect.succeed(files.get(path)!)
          : Effect.fail({ _tag: 'SystemError' as const, message: 'ENOENT' }),

    writeFileString: (path: string, content: string) =>
      state.failOnWrite
        ? Effect.fail({ _tag: 'SystemError' as const, message: 'Write failed' })
        : Effect.sync(() => {
            files.set(path, content);
          }),

    remove: (path: string) =>
      state.failOnRemove
        ? Effect.fail({ _tag: 'SystemError' as const, message: 'Remove failed' })
        : Effect.sync(() => {
            files.delete(path);
          }),

    makeDirectory: () =>
      state.failOnWrite ? Effect.fail({ _tag: 'SystemError' as const, message: 'Mkdir failed' }) : Effect.void,

    chmod: () =>
      state.failOnWrite ? Effect.fail({ _tag: 'SystemError' as const, message: 'Chmod failed' }) : Effect.void,
  } as unknown as FileSystem.FileSystem;
};

const mockPath: Path.Path = {
  join: (...segments: string[]) => segments.join('/'),
} as unknown as Path.Path;

const makeTestLayer = (fsState: Parameters<typeof makeMockFileSystem>[0]) => {
  const platformLayer = Layer.mergeAll(
    Layer.succeed(FileSystem.FileSystem, makeMockFileSystem(fsState)),
    Layer.succeed(Path.Path, mockPath)
  );

  return Layer.provide(AuthStorageService.Default, platformLayer).pipe(
    Layer.provideMerge(Logger.minimumLogLevel(LogLevel.None))
  );
};

// ---------------------------------------------------------------------------
// load
// ---------------------------------------------------------------------------

describe('AuthStorageService.load', () => {
  it('should return None when auth file does not exist', async () => {
    const testLayer = makeTestLayer({ files: {} });

    const result = await Effect.runPromise(Effect.provide(AuthStorageService.load, testLayer));

    expect(Option.isNone(result)).toBe(true);
  });

  it('should return Some with parsed auth data when file exists', async () => {
    const authData: StoredAuthData = { refreshToken: 'rt-123', accessToken: 'at-456', tokenExpirationTime: 9999999 };
    const authFilePath = `${HOMEDIR}/.gigadrive/auth.json`;

    const testLayer = makeTestLayer({
      files: { [authFilePath]: JSON.stringify(authData) },
    });

    const result = await Effect.runPromise(Effect.provide(AuthStorageService.load, testLayer));

    expect(Option.isSome(result)).toBe(true);
    if (Option.isSome(result)) {
      expect(result.value.refreshToken).toBe('rt-123');
      expect(result.value.accessToken).toBe('at-456');
      expect(result.value.tokenExpirationTime).toBe(9999999);
    }
  });

  it('should fail with AuthStorageReadError when file contains invalid JSON', async () => {
    const authFilePath = `${HOMEDIR}/.gigadrive/auth.json`;

    const testLayer = makeTestLayer({
      files: { [authFilePath]: 'not-valid-json' },
    });

    const result = await Effect.runPromise(
      Effect.provide(AuthStorageService.load, testLayer).pipe(
        Effect.catchTag('AuthStorageReadError', (err) =>
          Effect.succeed({ _tag: 'caught' as const, message: err.message })
        )
      )
    );

    expect(result).toMatchObject({ _tag: 'caught', message: 'Auth file contains invalid JSON' });
  });

  it('should fail with AuthStorageReadError when file has invalid schema', async () => {
    const authFilePath = `${HOMEDIR}/.gigadrive/auth.json`;

    const testLayer = makeTestLayer({
      files: { [authFilePath]: JSON.stringify({ notRefreshToken: 'oops' }) },
    });

    const result = await Effect.runPromise(
      Effect.provide(AuthStorageService.load, testLayer).pipe(
        Effect.catchTag('AuthStorageReadError', (err) =>
          Effect.succeed({ _tag: 'caught' as const, message: err.message })
        )
      )
    );

    expect(result).toMatchObject({ _tag: 'caught', message: 'Auth file has invalid schema' });
  });

  it('should fail with AuthStorageReadError when existence check fails', async () => {
    const testLayer = makeTestLayer({ failOnExists: true });

    const result = await Effect.runPromise(
      Effect.provide(AuthStorageService.load, testLayer).pipe(
        Effect.catchTag('AuthStorageReadError', (err) =>
          Effect.succeed({ _tag: 'caught' as const, message: err.message })
        )
      )
    );

    expect(result).toMatchObject({ _tag: 'caught', message: 'Failed to check auth file existence' });
  });
});

// ---------------------------------------------------------------------------
// save
// ---------------------------------------------------------------------------

describe('AuthStorageService.save', () => {
  it('should succeed when writing auth data', async () => {
    const testLayer = makeTestLayer({ files: {} });

    const authData: StoredAuthData = { refreshToken: 'rt-new', accessToken: 'at-new', tokenExpirationTime: 1234567 };

    await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const storage = yield* AuthStorageService;
          yield* storage.save(authData);
        }),
        testLayer
      )
    );
    // No exception means success
  });

  it('should fail with AuthStorageWriteError when mkdir fails', async () => {
    const testLayer = makeTestLayer({ failOnWrite: true });

    const authData: StoredAuthData = { refreshToken: 'rt' };

    const result = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const storage = yield* AuthStorageService;
          yield* storage.save(authData);
        }),
        testLayer
      ).pipe(
        Effect.catchTag('AuthStorageWriteError', (err) =>
          Effect.succeed({ _tag: 'caught' as const, message: err.message })
        )
      )
    );

    expect(result).toMatchObject({ _tag: 'caught', message: 'Failed to create auth directory' });
  });
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

describe('AuthStorageService.remove', () => {
  it('should fail with AuthStorageWriteError when remove fails with non-ENOENT error', async () => {
    const testLayer = makeTestLayer({ failOnRemove: true });

    // remove only suppresses ENOENT, other errors should propagate
    const result = await Effect.runPromise(
      Effect.provide(AuthStorageService.remove, testLayer).pipe(
        Effect.catchTag('AuthStorageWriteError', (err) =>
          Effect.succeed({ _tag: 'caught' as const, message: err.message })
        )
      )
    );

    expect(result).toMatchObject({ _tag: 'caught', message: 'Failed to remove auth file' });
  });

  it('should succeed when file exists', async () => {
    const authFilePath = `${HOMEDIR}/.gigadrive/auth.json`;

    const testLayer = makeTestLayer({
      files: { [authFilePath]: JSON.stringify({ refreshToken: 'rt' }) },
    });

    await Effect.runPromise(Effect.provide(AuthStorageService.remove, testLayer));
  });
});

import { Effect, Option, Schema } from 'effect';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { StoredAuthData } from '../domain';
import { StoredAuthData as StoredAuthDataSchema } from '../domain';
import { AuthStorageReadError, AuthStorageWriteError } from '../errors';

// ---------------------------------------------------------------------------
// Auth storage paths
// ---------------------------------------------------------------------------

const getAuthStoragePaths = () => {
  const homeDir = os.homedir();
  const authDir = path.join(homeDir, '.gigadrive');
  const authFile = path.join(authDir, 'auth.json');
  return { directory: authDir, file: authFile };
};

// ---------------------------------------------------------------------------
// AuthStorageService
// ---------------------------------------------------------------------------

export class AuthStorageService extends Effect.Service<AuthStorageService>()('AuthStorageService', {
  accessors: true,

  effect: Effect.gen(function* () {
    const paths = getAuthStoragePaths();

    const ensureDirectory = Effect.gen(function* () {
      yield* Effect.tryPromise({
        try: () => fs.promises.mkdir(paths.directory, { recursive: true, mode: 0o700 }),
        catch: (error) =>
          new AuthStorageWriteError({
            message: 'Failed to create auth directory',
            cause: error instanceof Error ? error.message : String(error),
          }),
      });
      yield* Effect.tryPromise({
        try: () => fs.promises.chmod(paths.directory, 0o700),
        catch: (error) =>
          new AuthStorageWriteError({
            message: 'Failed to set auth directory permissions',
            cause: error instanceof Error ? error.message : String(error),
          }),
      });
    });

    const load = Effect.gen(function* () {
      const exists = yield* Effect.sync(() => fs.existsSync(paths.file));
      if (!exists) return Option.none<StoredAuthData>();

      const data = yield* Effect.tryPromise({
        try: () => fs.promises.readFile(paths.file, 'utf8'),
        catch: () => new AuthStorageReadError({ message: 'Failed to read auth file' }),
      });

      const json = yield* Effect.try({
        try: () => JSON.parse(data) as unknown,
        catch: () => new AuthStorageReadError({ message: 'Auth file contains invalid JSON' }),
      });

      const authData = yield* Schema.decodeUnknown(StoredAuthDataSchema)(json).pipe(
        Effect.mapError(() => new AuthStorageReadError({ message: 'Auth file has invalid schema' }))
      );

      return Option.some(authData);
    });

    const save = Effect.fn('AuthStorageService.save')(function* (authData: StoredAuthData) {
      yield* ensureDirectory;
      yield* Effect.tryPromise({
        try: () =>
          fs.promises.writeFile(paths.file, JSON.stringify(authData, null, 2), {
            encoding: 'utf8',
            mode: 0o600,
          }),
        catch: (error) =>
          new AuthStorageWriteError({
            message: 'Failed to write auth file',
            cause: error instanceof Error ? error.message : String(error),
          }),
      });
      yield* Effect.tryPromise({
        try: () => fs.promises.chmod(paths.file, 0o600),
        catch: (error) =>
          new AuthStorageWriteError({
            message: 'Failed to set auth file permissions',
            cause: error instanceof Error ? error.message : String(error),
          }),
      });
      yield* Effect.log('Auth data saved to local storage');
    });

    const remove = Effect.gen(function* () {
      yield* Effect.tryPromise({
        try: () => fs.promises.unlink(paths.file),
        catch: () => new AuthStorageWriteError({ message: 'Failed to remove auth file' }),
      }).pipe(Effect.catchTag('AuthStorageWriteError', () => Effect.void));
      yield* Effect.log('Auth data removed from local storage');
    });

    return { load, save, remove };
  }),
}) {}

import { FileSystem, Path } from '@effect/platform';
import { Effect, Option, Schema } from 'effect';
import * as os from 'node:os';
import type { StoredAuthData } from '../domain';
import { StoredAuthData as StoredAuthDataSchema } from '../domain';
import { AuthStorageReadError, AuthStorageWriteError } from '../errors';

// ---------------------------------------------------------------------------
// AuthStorageService
// ---------------------------------------------------------------------------

export class AuthStorageService extends Effect.Service<AuthStorageService>()('AuthStorageService', {
  accessors: true,

  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;

    const homeDir = os.homedir();
    const authDir = pathService.join(homeDir, '.gigadrive');
    const authFile = pathService.join(authDir, 'auth.json');

    const ensureDirectory = Effect.gen(function* () {
      yield* fs.makeDirectory(authDir, { recursive: true }).pipe(
        Effect.mapError(
          (error) =>
            new AuthStorageWriteError({
              message: 'Failed to create auth directory',
              cause: String(error),
            })
        )
      );
      yield* fs.chmod(authDir, 0o700).pipe(
        Effect.mapError(
          (error) =>
            new AuthStorageWriteError({
              message: 'Failed to set auth directory permissions',
              cause: String(error),
            })
        )
      );
    });

    const load = Effect.gen(function* () {
      const exists = yield* fs
        .exists(authFile)
        .pipe(Effect.mapError(() => new AuthStorageReadError({ message: 'Failed to check auth file existence' })));
      if (!exists) return Option.none<StoredAuthData>();

      const data = yield* fs
        .readFileString(authFile, 'utf8')
        .pipe(Effect.mapError(() => new AuthStorageReadError({ message: 'Failed to read auth file' })));

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
      yield* fs.writeFileString(authFile, JSON.stringify(authData, null, 2), { mode: 0o600 }).pipe(
        Effect.mapError(
          (error) =>
            new AuthStorageWriteError({
              message: 'Failed to write auth file',
              cause: String(error),
            })
        )
      );
      yield* Effect.log('Auth data saved to local storage');
    });

    const remove = Effect.gen(function* () {
      yield* fs.remove(authFile).pipe(
        Effect.mapError(() => new AuthStorageWriteError({ message: 'Failed to remove auth file' })),
        Effect.catchTag('AuthStorageWriteError', () => Effect.void)
      );
      yield* Effect.log('Auth data removed from local storage');
    });

    return { load, save, remove };
  }),
}) {}

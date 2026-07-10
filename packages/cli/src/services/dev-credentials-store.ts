import { FileSystem, Path } from '@effect/platform';
import { Effect, Option, Schema } from 'effect';
import * as os from 'node:os';
import type { DevKeyEntry, DevKeyStore } from '../domain';
import { DevKeyStore as DevKeyStoreSchema } from '../domain';
import { DevCredentialsStoreReadError, DevCredentialsStoreWriteError } from '../errors';

// ---------------------------------------------------------------------------
// DevCredentialsStore
//
// Persists, per user/machine, the ID of the API key the CLI provisioned for
// local development, keyed by application ID. Lives at
// `~/.gigadrive/dev-keys.json` (mode 0o600, in the 0o700 dir). Only the key ID
// is stored — never the secret.
// ---------------------------------------------------------------------------

export class DevCredentialsStore extends Effect.Service<DevCredentialsStore>()('DevCredentialsStore', {
  accessors: true,

  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;

    const homeDir = os.homedir();
    const storeDir = pathService.join(homeDir, '.gigadrive');
    const storeFile = pathService.join(storeDir, 'dev-keys.json');

    const ensureDirectory = Effect.gen(function* () {
      yield* fs
        .makeDirectory(storeDir, { recursive: true })
        .pipe(
          Effect.mapError(
            (error) =>
              new DevCredentialsStoreWriteError({ message: 'Failed to create ~/.gigadrive', cause: String(error) })
          )
        );
      yield* fs.chmod(storeDir, 0o700).pipe(
        Effect.mapError(
          (error) =>
            new DevCredentialsStoreWriteError({
              message: 'Failed to set ~/.gigadrive permissions',
              cause: String(error),
            })
        )
      );
    });

    const load = Effect.gen(function* () {
      const present = yield* fs
        .exists(storeFile)
        .pipe(Effect.mapError(() => new DevCredentialsStoreReadError({ message: 'Failed to check dev-keys.json' })));
      if (!present) return {};

      const data = yield* fs
        .readFileString(storeFile, 'utf8')
        .pipe(Effect.mapError(() => new DevCredentialsStoreReadError({ message: 'Failed to read dev-keys.json' })));

      const json = yield* Effect.try({
        try: () => JSON.parse(data) as unknown,
        catch: () => new DevCredentialsStoreReadError({ message: 'dev-keys.json contains invalid JSON' }),
      });

      return yield* Schema.decodeUnknown(DevKeyStoreSchema)(json).pipe(
        Effect.mapError(() => new DevCredentialsStoreReadError({ message: 'dev-keys.json has an invalid schema' }))
      );
    });

    /** Look up the stored dev-key entry for an application. */
    const get = Effect.fn('DevCredentialsStore.get')(function* (applicationId: string) {
      const store = yield* load;
      const entry = store[applicationId];
      return entry ? Option.some(entry) : Option.none<DevKeyEntry>();
    });

    /** Record the provisioned key ID for an application. */
    const set = Effect.fn('DevCredentialsStore.set')(function* (applicationId: string, entry: DevKeyEntry) {
      const store = yield* load;
      const next: DevKeyStore = { ...store, [applicationId]: entry };
      yield* ensureDirectory;
      yield* fs
        .writeFileString(storeFile, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 })
        .pipe(
          Effect.mapError(
            (error) =>
              new DevCredentialsStoreWriteError({ message: 'Failed to write dev-keys.json', cause: String(error) })
          )
        );
    });

    return { get, set };
  }),
}) {}

import { FileSystem, Path } from '@effect/platform';
import { Effect, Option } from 'effect';
import { EnvFileReadError, EnvFileWriteError } from '../errors';
import { serializeEnv, type EnvEntry } from '../lib/dotenv';

// ---------------------------------------------------------------------------
// EnvFileService
//
// Reads and writes local `.env` files (and maintains `.gitignore`). Files may
// contain secrets (e.g. provisioned API credentials), so they are written with
// mode 0o600, mirroring AuthStorageService.
// ---------------------------------------------------------------------------

export class EnvFileService extends Effect.Service<EnvFileService>()('EnvFileService', {
  accessors: true,

  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;

    /** Whether a file exists at `filePath`. */
    const exists = Effect.fn('EnvFileService.exists')(function* (filePath: string) {
      return yield* fs
        .exists(filePath)
        .pipe(Effect.mapError(() => new EnvFileReadError({ message: `Failed to check whether ${filePath} exists` })));
    });

    /** Read a file's contents, returning `Option.none` when it does not exist. */
    const read = Effect.fn('EnvFileService.read')(function* (filePath: string) {
      const present = yield* exists(filePath);
      if (!present) return Option.none<string>();
      const contents = yield* fs
        .readFileString(filePath, 'utf8')
        .pipe(Effect.mapError(() => new EnvFileReadError({ message: `Failed to read ${filePath}` })));
      return Option.some(contents);
    });

    /** Serialize `entries` and write them to `filePath` with mode 0o600. */
    const write = Effect.fn('EnvFileService.write')(function* (
      filePath: string,
      entries: ReadonlyArray<EnvEntry>,
      opts?: { header?: string }
    ) {
      const dir = pathService.dirname(filePath);
      yield* fs
        .makeDirectory(dir, { recursive: true })
        .pipe(
          Effect.mapError(
            (error) =>
              new EnvFileWriteError({ message: `Failed to create directory for ${filePath}`, cause: String(error) })
          )
        );
      yield* fs
        .writeFileString(filePath, serializeEnv(entries, opts), { mode: 0o600 })
        .pipe(
          Effect.mapError(
            (error) => new EnvFileWriteError({ message: `Failed to write ${filePath}`, cause: String(error) })
          )
        );
    });

    /**
     * Ensure `entry` is present in `<dir>/.gitignore`, creating the file when
     * needed. Returns `true` when the entry was added, `false` when it was
     * already ignored.
     */
    const ensureGitignored = Effect.fn('EnvFileService.ensureGitignored')(function* (dir: string, entry: string) {
      const gitignorePath = pathService.join(dir, '.gitignore');
      const existing = yield* read(gitignorePath);
      const current = Option.getOrElse(existing, () => '');
      const alreadyIgnored = current.split('\n').some((line) => line.trim() === entry);
      if (alreadyIgnored) {
        return false;
      }
      const separator = current.length > 0 && !current.endsWith('\n') ? '\n' : '';
      yield* fs
        .writeFileString(gitignorePath, `${current}${separator}${entry}\n`)
        .pipe(
          Effect.mapError(
            (error) => new EnvFileWriteError({ message: 'Failed to update .gitignore', cause: String(error) })
          )
        );
      return true;
    });

    return { exists, read, write, ensureGitignored };
  }),
}) {}

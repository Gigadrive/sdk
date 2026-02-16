import { FileSystem, Path } from '@effect/platform';
import { exec } from '@gigadrive/build-utils';
import { Effect } from 'effect';
import type { PackageManager } from '../domain';
import { ExecError, PackageManagerNotFoundError } from '../errors';

// ---------------------------------------------------------------------------
// PackageManagerService
// ---------------------------------------------------------------------------

export class PackageManagerService extends Effect.Service<PackageManagerService>()('PackageManagerService', {
  accessors: true,

  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;

    const detect = Effect.fn('PackageManagerService.detect')(function* (cwd: string) {
      yield* Effect.annotateCurrentSpan('cwd', cwd);

      const packageJsonPath = pathService.join(cwd, 'package.json');
      const exists = yield* fs
        .exists(packageJsonPath)
        .pipe(
          Effect.mapError(
            () => new PackageManagerNotFoundError({ message: 'Failed to check for package.json', directory: cwd })
          )
        );
      if (!exists) {
        return yield* Effect.fail(
          new PackageManagerNotFoundError({
            message: 'No package.json found',
            directory: cwd,
          })
        );
      }

      // Check lock files in priority order
      const lockChecks: Array<{ file: string; pm: PackageManager }> = [
        { file: 'yarn.lock', pm: 'yarn' },
        { file: 'pnpm-lock.yaml', pm: 'pnpm' },
        { file: 'bun.lockb', pm: 'bun' },
        { file: 'package-lock.json', pm: 'npm' },
      ];

      for (const { file, pm } of lockChecks) {
        const lockExists = yield* fs
          .exists(pathService.join(cwd, file))
          .pipe(Effect.catchAll(() => Effect.succeed(false)));
        if (lockExists) {
          yield* Effect.log('Package manager detected from lock file', { packageManager: pm, lockFile: file });
          return pm;
        }
      }

      // Fallback: check if bun is installed
      const bunAvailable = yield* Effect.tryPromise({
        try: () => exec({ command: 'bun --version', cwd }),
        catch: () => new ExecError({ message: 'bun not found', command: 'bun --version' }),
      }).pipe(
        Effect.as(true),
        Effect.catchTag('ExecError', () => Effect.succeed(false))
      );

      const pm: PackageManager = bunAvailable ? 'bun' : 'npm';
      yield* Effect.log('Package manager detected via fallback', { packageManager: pm });
      return pm;
    });

    const installCommand = (pm: PackageManager): string =>
      ({
        bun: 'bun install',
        npm: 'npm install',
        pnpm: 'pnpm install',
        yarn: 'yarn install',
      })[pm];

    const buildCommand = (pm: PackageManager): string =>
      ({
        bun: 'bun run build',
        npm: 'npm run build',
        pnpm: 'pnpm build',
        yarn: 'yarn build',
      })[pm];

    return { detect, installCommand, buildCommand };
  }),
}) {}

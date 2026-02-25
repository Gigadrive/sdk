import { FileSystem, Path } from '@effect/platform';
import { Effect } from 'effect';
import type { PackageManager } from './types';

/**
 * Lockfile-to-package-manager mapping, checked in priority order.
 */
const LOCKFILE_MAP: Array<{ files: string[]; pm: PackageManager }> = [
  { files: ['bun.lockb', 'bun.lock'], pm: 'bun' },
  { files: ['pnpm-lock.yaml'], pm: 'pnpm' },
  { files: ['yarn.lock'], pm: 'yarn' },
  { files: ['package-lock.json'], pm: 'npm' },
  { files: ['composer.lock'], pm: 'composer' },
];

/**
 * Detects the package manager by checking for lockfiles in the project folder.
 * Falls back to `npm` if no lockfile is found.
 *
 * @param projectFolder - Absolute path to the project root
 * @returns The detected package manager
 */
export const detectPackageManager = Effect.fn('detectPackageManager')(function* (projectFolder: string) {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;

  for (const { files, pm } of LOCKFILE_MAP) {
    for (const file of files) {
      const exists = yield* fs
        .exists(pathService.join(projectFolder, file))
        .pipe(Effect.catchAll(() => Effect.succeed(false)));
      if (exists) {
        yield* Effect.logDebug(`Detected package manager: ${pm} (via ${file})`);
        return pm;
      }
    }
  }

  yield* Effect.logDebug('No lockfile found, defaulting to npm');
  return 'npm' satisfies PackageManager;
});

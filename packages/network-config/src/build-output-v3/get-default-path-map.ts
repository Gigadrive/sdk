import { FileSystem, Path } from '@effect/platform';
import { Effect } from 'effect';

/**
 * Creates a mapping of absolute file paths to their relative paths
 * starting from the provided directory.
 *
 * This is the default path map that will be used for Vercel-based functions,
 * when the function does not specify a filePathMap.
 *
 * @param directory - The absolute path of the directory to process
 * @returns A record where keys are absolute file paths and values are relative paths
 */
export const getDefaultPathMap = Effect.fn('getDefaultPathMap')(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const result: Record<string, string> = {};

  const exists = yield* fs.exists(directory).pipe(Effect.catchAll(() => Effect.succeed(false)));
  if (!exists) {
    return result;
  }

  const MAX_DEPTH = 100;

  // Inner helper that closes over `fs`, `pathService`, and `result` — not extracted
  // to Effect.fn because it mutates the outer `result` record via closure.
  const processDirectory = (currentPath: string, basePath: string = '', depth: number = 0): Effect.Effect<void> =>
    Effect.gen(function* () {
      if (depth > MAX_DEPTH) return;

      const entries = yield* fs.readDirectory(currentPath).pipe(Effect.catchAll(() => Effect.succeed([] as string[])));

      for (const name of entries) {
        const fullPath = pathService.join(currentPath, name);
        const relativePath = basePath ? pathService.join(basePath, name) : name;

        const stat = yield* fs.stat(fullPath).pipe(Effect.catchAll(() => Effect.succeed(null)));
        if (!stat) continue;

        if (stat.type === 'Directory') {
          yield* processDirectory(fullPath, relativePath, depth + 1);
        } else {
          result[fullPath] = relativePath;
        }
      }
    });

  yield* processDirectory(directory);
  return result;
});

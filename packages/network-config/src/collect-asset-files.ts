import { FileSystem, Path } from '@effect/platform';
import { Effect } from 'effect';

/**
 * Maximum directory nesting depth for asset collection.
 * Guards against symlink-induced infinite recursion where constructed paths
 * grow monotonically (e.g. `/assets/link/link/link/...`).
 */
const MAX_ASSET_DEPTH = 100;

/** Server configuration files that must never be published as static assets. */
const DISALLOWED_ASSET_EXTENSIONS = ['.htaccess', '.htpasswd'];

/**
 * Recursively collects all file paths relative to the base directory.
 */
const collectFilesRecursively: (
  basePath: string,
  relativePath?: string,
  depth?: number
) => Effect.Effect<string[], never, FileSystem.FileSystem | Path.Path> = Effect.fn('collectFilesRecursively')(
  function* (basePath: string, relativePath: string = '', depth: number = 0) {
    if (depth > MAX_ASSET_DEPTH) return [] as string[];

    const fs = yield* FileSystem.FileSystem;
    const pathSvc = yield* Path.Path;

    const currentPath = relativePath ? pathSvc.join(basePath, relativePath) : basePath;

    const entries = yield* fs.readDirectory(currentPath).pipe(Effect.catchAll(() => Effect.succeed([] as string[])));
    const result: string[] = [];

    for (const name of entries) {
      const fullPath = pathSvc.join(currentPath, name);
      const entryRelative = relativePath ? pathSvc.join(relativePath, name) : name;
      const stat = yield* fs.stat(fullPath).pipe(Effect.catchAll(() => Effect.succeed(null)));

      if (!stat) continue;

      if (stat.type === 'Directory') {
        const nested = yield* collectFilesRecursively(basePath, entryRelative, depth + 1);
        result.push(...nested);
      } else {
        result.push(entryRelative);
      }
    }

    return result;
  }
);

/**
 * Lists every publishable file inside a static asset directory.
 *
 * Both the `assets:` key of a user config and a framework's `assetsDir` mean
 * "publish this directory to the edge", and both resolve that declaration into
 * concrete file paths through this walker.
 *
 * @param projectFolder - Absolute path to the project root
 * @param assetsDir - Project-relative asset directory (e.g. `dist`, `.output/public`)
 * @returns Sorted forward-slash paths relative to `assetsDir`. Empty when the
 * directory is missing or is not a directory, so a project that never produced
 * the expected build output fails config validation instead of the walker.
 */
export const collectAssetFiles = Effect.fn('collectAssetFiles')(function* (projectFolder: string, assetsDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;

  const assetsPath = pathService.join(projectFolder, assetsDir);
  const stat = yield* fs.stat(assetsPath).pipe(Effect.catchAll(() => Effect.succeed(null)));
  if (!stat || stat.type !== 'Directory') return [] as string[];

  const files = yield* collectFilesRecursively(assetsPath);

  return files
    .map((file) => file.replaceAll('\\', '/'))
    .filter((file) => !DISALLOWED_ASSET_EXTENSIONS.some((extension) => file.toLowerCase().endsWith(extension)))
    .sort();
});

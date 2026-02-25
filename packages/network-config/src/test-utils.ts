import { FileSystem, Path } from '@effect/platform';
import { NodePath } from '@effect/platform-node';
import { Effect, Layer } from 'effect';

/**
 * Creates a test FileSystem layer backed by an in-memory file map.
 * Directories are inferred from file paths (any prefix of a stored path that
 * ends before a `/` is treated as an existing directory).
 *
 * @param files - Record mapping absolute paths to file contents
 */
export const makeTestFs = (files: Record<string, string>) => {
  const filePaths = Object.keys(files);

  /** Derive the set of directories implied by the stored file paths. */
  const directories = new Set<string>();
  for (const p of filePaths) {
    const parts = p.split('/');
    let current = '';
    for (let i = 0; i < parts.length - 1; i++) {
      current += (i === 0 ? '' : '/') + parts[i];
      if (current) directories.add(current);
    }
  }

  return Layer.succeed(FileSystem.FileSystem, {
    exists: (path: string) => Effect.succeed(path in files || directories.has(path)),
    readFileString: (path: string) =>
      path in files ? Effect.succeed(files[path]) : Effect.fail(new Error(`File not found: ${path}`)),
    readDirectory: (path: string) => {
      const prefix = path.endsWith('/') ? path : path + '/';
      const entries = new Set<string>();
      for (const p of filePaths) {
        if (p.startsWith(prefix)) {
          const rest = p.slice(prefix.length);
          const firstSegment = rest.split('/')[0];
          entries.add(firstSegment);
        }
      }
      // Also include sub-directories
      for (const d of directories) {
        if (d.startsWith(prefix)) {
          const rest = d.slice(prefix.length);
          const firstSegment = rest.split('/')[0];
          if (firstSegment) entries.add(firstSegment);
        }
      }
      return Effect.succeed([...entries]);
    },
    stat: (path: string) => {
      if (path in files) {
        return Effect.succeed({ type: 'File' } as unknown as FileSystem.File.Info);
      }
      if (directories.has(path)) {
        return Effect.succeed({ type: 'Directory' } as unknown as FileSystem.File.Info);
      }
      return Effect.fail(new Error(`Not found: ${path}`));
    },
  } as unknown as FileSystem.FileSystem);
};

/**
 * Provides the real Node.js `Path.Path` implementation for tests.
 * Compose with `makeTestFs` via `Layer.merge(makeTestFs(files), TestPathLayer)`.
 */
export const TestPathLayer: Layer.Layer<Path.Path> = NodePath.layer;

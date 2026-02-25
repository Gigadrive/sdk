import { FileSystem } from '@effect/platform';
import { Effect } from 'effect';
import type { FrameworkLanguage } from './types';
import { ManifestNotFoundError, ManifestParseError, ManifestReadError } from './types';

/**
 * Manifest file configuration for each supported language.
 */
const MANIFEST_CONFIG: Record<FrameworkLanguage, { file: string; depKeys: string[] }> = {
  node: { file: 'package.json', depKeys: ['dependencies', 'devDependencies'] },
  php: { file: 'composer.json', depKeys: ['require', 'require-dev'] },
};

/**
 * Reads and parses a JSON manifest file, returning the parsed object.
 *
 * @param filePath - Absolute path to the manifest file
 * @returns The parsed JSON object, or fails with ManifestReadError
 */
const readManifest = Effect.fn('readManifest')(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;

  const exists = yield* fs.exists(filePath).pipe(Effect.catchAll(() => Effect.succeed(false)));
  if (!exists) {
    return yield* Effect.fail(new ManifestNotFoundError({ message: 'Manifest not found', filePath }));
  }

  const content = yield* fs
    .readFileString(filePath)
    .pipe(Effect.mapError(() => new ManifestReadError({ message: 'Failed to read manifest', filePath })));

  const parsed = yield* Effect.try({
    try: () => JSON.parse(content) as Record<string, unknown>,
    catch: () => new ManifestParseError({ message: 'Failed to parse manifest JSON', filePath }),
  });

  return parsed;
});

/**
 * Reads dependency names from the appropriate manifest file for a language.
 * Returns a set of all dependency names (production + dev).
 *
 * If the manifest file does not exist, returns an empty set (not an error).
 *
 * @param projectFolder - Absolute path to the project root
 * @param language - The framework language to determine which manifest to read
 * @returns A set of dependency package names
 */
export const readDependencies = Effect.fn('readDependencies')(function* (
  projectFolder: string,
  language: FrameworkLanguage
) {
  const config = MANIFEST_CONFIG[language];
  const filePath = `${projectFolder}/${config.file}`;

  const manifest = yield* readManifest(filePath).pipe(
    Effect.catchTag('ManifestNotFoundError', () => Effect.succeed(null))
  );

  if (!manifest) {
    return new Set<string>();
  }

  const deps = new Set<string>();

  for (const key of config.depKeys) {
    const section = manifest[key];
    if (section && typeof section === 'object' && !Array.isArray(section)) {
      for (const name of Object.keys(section as Record<string, unknown>)) {
        deps.add(name);
      }
    }
  }

  return deps;
});

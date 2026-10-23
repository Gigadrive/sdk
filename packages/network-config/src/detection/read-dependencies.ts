import { FileSystem, Path } from '@effect/platform';
import { Effect } from 'effect';
import type { FrameworkLanguage } from './types';
import { ManifestNotFoundError, ManifestParseError, ManifestReadError } from './types';

/**
 * JSON manifest configuration for each language that declares dependencies in
 * JSON. Ruby's Bundler files are plain text and read by {@link readGemNames}.
 */
const MANIFEST_CONFIG: Record<Exclude<FrameworkLanguage, 'ruby'>, { file: string; depKeys: string[] }> = {
  node: { file: 'package.json', depKeys: ['dependencies', 'devDependencies'] },
  php: { file: 'composer.json', depKeys: ['require', 'require-dev'] },
};

/** Gemfile.lock sections whose `specs:` list resolved gems. */
const GEMFILE_LOCK_SOURCE_SECTIONS = new Set(['GEM', 'GIT', 'PATH']);

/** A resolved gem in a Gemfile.lock `specs:` list, e.g. `    railties (7.1.3)`. */
const GEMFILE_LOCK_SPEC = /^ {4}([A-Za-z0-9_.-]+) \(/;

/** A `gem "name"` (or `gem("name")`) declaration in a Gemfile. */
const GEMFILE_GEM = /^\s*gem[\s(]+['"]([^'"]+)['"]/;

/**
 * Lists every gem a `Gemfile.lock` resolved: the names in the `specs:` lists
 * of its `GEM`, `GIT` and `PATH` sections, so transitive gems such as
 * `railties` count too. Dependencies of a spec (indented six spaces) and the
 * other sections (`DEPENDENCIES`, `PLATFORMS`, `CHECKSUMS`, ...) are skipped.
 */
const parseGemfileLock = (content: string) => {
  const gems = new Set<string>();
  let inSourceSection = false;
  for (const line of content.split(/\r?\n/)) {
    if (/^\S/.test(line)) {
      // A new top-level section such as `GEM` or `DEPENDENCIES`.
      inSourceSection = GEMFILE_LOCK_SOURCE_SECTIONS.has(line.trim());
      continue;
    }
    const match = inSourceSection ? GEMFILE_LOCK_SPEC.exec(line) : null;
    if (match) {
      gems.add(match[1]);
    }
  }
  return gems;
};

/** Lists the gems a `Gemfile` declares directly. */
const parseGemfile = (content: string) => {
  const gems = new Set<string>();
  for (const line of content.split(/\r?\n/)) {
    const match = GEMFILE_GEM.exec(line);
    if (match) {
      gems.add(match[1]);
    }
  }
  return gems;
};

/**
 * Reads a text file that may be missing.
 *
 * @returns The content, or `undefined` when the file does not exist; fails
 *   with `ManifestReadError` when it exists but cannot be read.
 */
const readOptionalText = Effect.fn('readOptionalText')(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(filePath).pipe(Effect.catchAll(() => Effect.succeed(false)));
  if (!exists) {
    return undefined;
  }
  return yield* fs
    .readFileString(filePath)
    .pipe(Effect.mapError(() => new ManifestReadError({ message: 'Failed to read manifest', filePath })));
});

/**
 * Reads the gem names of a Ruby project: every gem `Gemfile.lock` resolved
 * when it exists (including transitive ones), otherwise the gems the
 * `Gemfile` declares. Without either file the set is empty.
 */
const readGemNames = Effect.fn('readGemNames')(function* (projectFolder: string) {
  const pathService = yield* Path.Path;

  const lockfile = yield* readOptionalText(pathService.join(projectFolder, 'Gemfile.lock'));
  if (lockfile !== undefined) {
    return parseGemfileLock(lockfile);
  }

  const gemfile = yield* readOptionalText(pathService.join(projectFolder, 'Gemfile'));
  return gemfile === undefined ? new Set<string>() : parseGemfile(gemfile);
});

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
 * Returns a set of all dependency names (production + dev). For Ruby these are
 * the gems in `Gemfile.lock`, including transitive ones, or the gems the
 * `Gemfile` declares when there is no lockfile.
 *
 * If the manifest file does not exist, returns an empty set (graceful).
 * If the file exists but cannot be read (`ManifestReadError`) or parsed
 * (`ManifestParseError`), the error propagates — this indicates a real
 * problem the user should know about.
 *
 * @param projectFolder - Absolute path to the project root
 * @param language - The framework language to determine which manifest to read
 * @returns A set of dependency package names
 */
export const readDependencies = Effect.fn('readDependencies')(function* (
  projectFolder: string,
  language: FrameworkLanguage
) {
  if (language === 'ruby') {
    return yield* readGemNames(projectFolder);
  }

  const pathService = yield* Path.Path;
  const config = MANIFEST_CONFIG[language];
  const filePath = pathService.join(projectFolder, config.file);

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
      for (const name of Object.keys(section)) {
        deps.add(name);
      }
    }
  }

  return deps;
});

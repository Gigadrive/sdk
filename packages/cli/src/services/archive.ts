import { FileSystem, Path } from '@effect/platform';
import { getFilesForPattern } from '@gigadrive/build-utils';
import archiver from 'archiver';
import { Effect } from 'effect';
import ignore, { type Ignore } from 'ignore';
import * as nodeFs from 'node:fs';
import * as nodeFsPromises from 'node:fs/promises';
import { ArchiveCreateError } from '../errors';

// ---------------------------------------------------------------------------
// Ignore file handling
// ---------------------------------------------------------------------------

const IGNORE_FILE_NAMES = ['.gigadriveignore', '.vercelignore', '.dockerignore', '.nowignore'];

const readIgnoreFile = (fs: FileSystem.FileSystem, ignorePath: string): Effect.Effect<string[]> =>
  fs.readFileString(ignorePath, 'utf8').pipe(
    Effect.map((content) => content.split('\n').filter((line: string) => line.trim() !== '')),
    Effect.catchAll(() => Effect.succeed([] as string[]))
  );

const collectIgnorePatterns = (
  fs: FileSystem.FileSystem,
  pathService: Path.Path,
  dir: string,
  baseDir: string,
  ignoreRules: Ignore
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const items = yield* fs
      .readDirectory(dir)
      .pipe(Effect.mapError(() => new ArchiveCreateError({ message: `Failed to read directory: ${dir}` })));

    for (const item of items) {
      const fullPath = pathService.join(dir, item);
      const relativePath = pathService.relative(baseDir, fullPath);
      // Use lstat to avoid following symlinks (matches original behavior)
      const stat = yield* Effect.tryPromise({
        try: () => nodeFsPromises.lstat(fullPath),
        catch: () => new ArchiveCreateError({ message: `Failed to stat: ${fullPath}` }),
      });

      if (stat.isDirectory()) {
        if (ignoreRules.ignores(`${relativePath}/`)) continue;

        for (const ignoreFileName of IGNORE_FILE_NAMES) {
          const ignoreFilePath = pathService.join(fullPath, ignoreFileName);
          const patterns = yield* readIgnoreFile(fs, ignoreFilePath);
          if (patterns.length > 0) {
            ignoreRules.add(
              patterns.map((pattern: string) =>
                pattern.startsWith('!')
                  ? `!${pathService.join(relativePath, pattern.slice(1))}`
                  : pathService.join(relativePath, pattern)
              )
            );
          }
        }

        yield* collectIgnorePatterns(fs, pathService, fullPath, baseDir, ignoreRules);
      }
    }
  }).pipe(Effect.catchAll(() => Effect.void));

const initializeIgnoreRules = (
  fs: FileSystem.FileSystem,
  pathService: Path.Path,
  baseDir: string
): Effect.Effect<Ignore> =>
  Effect.gen(function* () {
    const ignoreRules = ignore();
    ignoreRules.add(['.git/', '**/.DS_Store', '**/Thumbs.db']);

    for (const ignoreFileName of IGNORE_FILE_NAMES) {
      const ignoreFilePath = pathService.join(baseDir, ignoreFileName);
      const patterns = yield* readIgnoreFile(fs, ignoreFilePath);
      if (patterns.length > 0) {
        ignoreRules.add(
          patterns.map((pattern: string) => (pattern.startsWith('!') ? `!${pattern.slice(1)}` : pattern))
        );
      }
    }

    yield* collectIgnorePatterns(fs, pathService, baseDir, baseDir, ignoreRules);
    return ignoreRules;
  });

const getFilesToInclude = (
  fs: FileSystem.FileSystem,
  pathService: Path.Path,
  dir: string,
  ignoreRules: Ignore
): Effect.Effect<string[]> =>
  Effect.gen(function* () {
    const filesToInclude: string[] = [];

    const walkDir = (currentDir: string): Effect.Effect<void> =>
      Effect.gen(function* () {
        const items = yield* fs
          .readDirectory(currentDir)
          .pipe(Effect.mapError(() => new ArchiveCreateError({ message: `Failed to read directory: ${currentDir}` })));

        for (const item of items) {
          const fullPath = pathService.join(currentDir, item);
          const relativePath = pathService.relative(dir, fullPath);
          // Use lstat to avoid following symlinks (matches original behavior)
          const stat = yield* Effect.tryPromise({
            try: () => nodeFsPromises.lstat(fullPath),
            catch: () => new ArchiveCreateError({ message: `Failed to stat: ${fullPath}` }),
          });

          if (stat.isDirectory()) {
            if (!ignoreRules.ignores(`${relativePath}/`)) {
              yield* walkDir(fullPath);
            }
          } else {
            if (!ignoreRules.ignores(relativePath)) {
              filesToInclude.push(fullPath);
            }
          }
        }
      }).pipe(Effect.catchAll(() => Effect.void));

    yield* walkDir(dir);
    return filesToInclude;
  });

// ---------------------------------------------------------------------------
// ArchiveService
// ---------------------------------------------------------------------------

export class ArchiveService extends Effect.Service<ArchiveService>()('ArchiveService', {
  accessors: true,

  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;

    const createZipArchive = Effect.fn('ArchiveService.createZipArchive')(function* (
      inputDir: string,
      outputFile: string,
      options: {
        whitelist?: string[];
        excludeFiles?: string[];
        useIgnoreFiles?: boolean;
        useManagedIgnore?: boolean;
      } = {}
    ) {
      yield* Effect.annotateCurrentSpan('inputDir', inputDir);
      yield* Effect.annotateCurrentSpan('outputFile', outputFile);
      yield* Effect.log('Creating zip archive', { inputDir, outputFile });

      const ignoreRules =
        options.useIgnoreFiles !== false ? yield* initializeIgnoreRules(fs, pathService, inputDir) : ignore();

      const filesToInclude = options.whitelist
        ? yield* Effect.tryPromise({
            try: () =>
              Promise.all(
                options.whitelist!.map((file) => getFilesForPattern(file, inputDir, options.excludeFiles ?? []))
              ),
            catch: (error) =>
              new ArchiveCreateError({
                message: 'Failed to resolve whitelist patterns',
                cause: error instanceof Error ? error.message : String(error),
              }),
          })
        : yield* Effect.gen(function* () {
            // Add excludeFiles patterns (from framework detection or user config) to ignore rules
            if (options.excludeFiles && options.excludeFiles.length > 0) {
              ignoreRules.add(options.excludeFiles);
            }
            return yield* getFilesToInclude(fs, pathService, inputDir, ignoreRules).pipe(
              Effect.map((files) => [files])
            );
          });

      // Remove existing archive if present
      const archiveExists = yield* fs.exists(outputFile).pipe(Effect.catchAll(() => Effect.succeed(false)));
      if (archiveExists) {
        yield* fs.remove(outputFile).pipe(
          Effect.mapError(
            (error) =>
              new ArchiveCreateError({
                message: `Failed to remove existing archive: ${String(error)}`,
              })
          )
        );
      }

      yield* Effect.tryPromise({
        try: () =>
          new Promise<void>((resolve, reject) => {
            // archiver requires a Node.js writable stream
            const output = nodeFs.createWriteStream(outputFile);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => resolve());
            output.on('error', reject);
            archive.on('error', reject);
            archive.pipe(output);

            for (const file of filesToInclude.flat()) {
              archive.file(file, { name: pathService.relative(inputDir, file) });
            }

            void archive.finalize();
          }),
        catch: (error) =>
          new ArchiveCreateError({
            message: 'Failed to create zip archive',
            cause: error instanceof Error ? error.message : String(error),
          }),
      });

      const fileInfo = yield* fs.stat(outputFile).pipe(
        Effect.mapError(
          (error) =>
            new ArchiveCreateError({
              message: `Failed to stat archive: ${String(error)}`,
            })
        )
      );
      const size = Number(fileInfo.size);
      yield* Effect.log('Archive created', { size });

      return { path: outputFile, size };
    });

    return { createZipArchive };
  }),
}) {}

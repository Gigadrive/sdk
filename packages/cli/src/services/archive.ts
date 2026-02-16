import { getFilesForPattern } from '@gigadrive/build-utils';
import archiver from 'archiver';
import { Effect } from 'effect';
import ignore, { type Ignore } from 'ignore';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import { ArchiveCreateError } from '../errors';

// ---------------------------------------------------------------------------
// Ignore file handling
// ---------------------------------------------------------------------------

const IGNORE_FILE_NAMES = ['.gigadriveignore', '.vercelignore', '.dockerignore', '.nowignore'];

const readIgnoreFile = (ignorePath: string): Effect.Effect<string[], never, never> =>
  Effect.tryPromise({
    try: async () => {
      await fsPromises.access(ignorePath);
      const content = await fsPromises.readFile(ignorePath, 'utf8');
      return content.split('\n').filter((line: string) => line.trim() !== '');
    },
    catch: () => [] as never,
  }).pipe(Effect.catchAll(() => Effect.succeed([] as string[])));

const collectIgnorePatterns = (dir: string, baseDir: string, ignoreRules: Ignore): Effect.Effect<void> =>
  Effect.gen(function* () {
    const items = yield* Effect.tryPromise({
      try: () => fsPromises.readdir(dir),
      catch: () => new ArchiveCreateError({ message: `Failed to read directory: ${dir}` }),
    });

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const relativePath = path.relative(baseDir, fullPath);
      const stat = yield* Effect.tryPromise({
        try: () => fsPromises.lstat(fullPath),
        catch: () => new ArchiveCreateError({ message: `Failed to stat: ${fullPath}` }),
      });

      if (stat.isDirectory()) {
        if (ignoreRules.ignores(`${relativePath}/`)) continue;

        for (const ignoreFileName of IGNORE_FILE_NAMES) {
          const ignoreFilePath = path.join(fullPath, ignoreFileName);
          const patterns = yield* readIgnoreFile(ignoreFilePath);
          if (patterns.length > 0) {
            ignoreRules.add(
              patterns.map((pattern: string) =>
                pattern.startsWith('!')
                  ? `!${path.join(relativePath, pattern.slice(1))}`
                  : path.join(relativePath, pattern)
              )
            );
          }
        }

        yield* collectIgnorePatterns(fullPath, baseDir, ignoreRules);
      }
    }
  }).pipe(Effect.catchAll(() => Effect.void));

const initializeIgnoreRules = (baseDir: string): Effect.Effect<Ignore> =>
  Effect.gen(function* () {
    const ignoreRules = ignore();
    ignoreRules.add(['.git/', '**/.DS_Store', '**/Thumbs.db']);

    for (const ignoreFileName of IGNORE_FILE_NAMES) {
      const ignoreFilePath = path.join(baseDir, ignoreFileName);
      const patterns = yield* readIgnoreFile(ignoreFilePath);
      if (patterns.length > 0) {
        ignoreRules.add(
          patterns.map((pattern: string) => (pattern.startsWith('!') ? `!${pattern.slice(1)}` : pattern))
        );
      }
    }

    yield* collectIgnorePatterns(baseDir, baseDir, ignoreRules);
    return ignoreRules;
  });

const getFilesToInclude = (dir: string, ignoreRules: Ignore): Effect.Effect<string[]> =>
  Effect.gen(function* () {
    const filesToInclude: string[] = [];

    const walkDir = (currentDir: string): Effect.Effect<void> =>
      Effect.gen(function* () {
        const items = yield* Effect.tryPromise({
          try: () => fsPromises.readdir(currentDir),
          catch: () => new ArchiveCreateError({ message: `Failed to read directory: ${currentDir}` }),
        });

        for (const item of items) {
          const fullPath = path.join(currentDir, item);
          const relativePath = path.relative(dir, fullPath);
          const stat = yield* Effect.tryPromise({
            try: () => fsPromises.lstat(fullPath),
            catch: () => new ArchiveCreateError({ message: `Failed to stat: ${fullPath}` }),
          });

          if (stat.isDirectory()) {
            if (!ignoreRules.ignores(`${relativePath}/`)) {
              yield* walkDir(fullPath);
            }
          } else {
            if (
              !ignoreRules.ignores(relativePath) ||
              (ignoreRules.ignores(relativePath) && ignoreRules.test(relativePath).unignored)
            ) {
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
    const createZipArchive = Effect.fn('ArchiveService.createZipArchive')(function* (
      inputDir: string,
      outputFile: string,
      options: {
        whitelist?: string[];
        useIgnoreFiles?: boolean;
        useManagedIgnore?: boolean;
      } = {}
    ) {
      yield* Effect.annotateCurrentSpan('inputDir', inputDir);
      yield* Effect.annotateCurrentSpan('outputFile', outputFile);
      yield* Effect.log('Creating zip archive', { inputDir, outputFile });

      const ignoreRules = options.useIgnoreFiles !== false ? yield* initializeIgnoreRules(inputDir) : ignore();

      const filesToInclude = options.whitelist
        ? yield* Effect.tryPromise({
            try: () => Promise.all(options.whitelist!.map((file) => getFilesForPattern(inputDir, file))),
            catch: (error) =>
              new ArchiveCreateError({
                message: 'Failed to resolve whitelist patterns',
                cause: error instanceof Error ? error.message : String(error),
              }),
          })
        : yield* getFilesToInclude(inputDir, ignoreRules).pipe(Effect.map((files) => [files]));

      // Remove existing archive if present
      const archiveExists = yield* Effect.sync(() => fs.existsSync(outputFile));
      if (archiveExists) {
        yield* Effect.sync(() => fs.unlinkSync(outputFile));
      }

      yield* Effect.tryPromise({
        try: () =>
          new Promise<void>((resolve, reject) => {
            const output = fs.createWriteStream(outputFile);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => resolve());
            archive.on('error', reject);
            archive.pipe(output);

            for (const file of filesToInclude.flat()) {
              archive.file(file, { name: path.relative(inputDir, file) });
            }

            void archive.finalize();
          }),
        catch: (error) =>
          new ArchiveCreateError({
            message: 'Failed to create zip archive',
            cause: error instanceof Error ? error.message : String(error),
          }),
      });

      const fileStats = yield* Effect.sync(() => fs.statSync(outputFile));
      yield* Effect.log('Archive created', { size: fileStats.size });

      return { path: outputFile, size: fileStats.size };
    });

    return { createZipArchive };
  }),
}) {}

import { FileSystem, Path } from '@effect/platform';
import { Effect } from 'effect';
import { parse as parseYaml } from 'yaml';
import { ConfigFileEmptyError, ConfigFileNotFoundError, ConfigFileParseError, ConfigVersionError } from '../errors';

export const ALLOWED_CONFIG_NAMES = ['gigadrive.yaml', 'gigadrive.yml', 'nebula.yaml', 'nebula.yml', 'nebula.json'];

export class RawConfigReader extends Effect.Service<RawConfigReader>()('RawConfigReader', {
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;

    /**
     * Scans for a known config filename in the given project folder.
     *
     * @param projectFolder - Absolute path to the project root
     * @returns The absolute path to the first matching config file, or null
     */
    const findConfig = Effect.fn('RawConfigReader.findConfig')(function* (projectFolder: string) {
      for (const name of ALLOWED_CONFIG_NAMES) {
        const filePath = pathService.join(projectFolder, name);
        const exists = yield* fs.exists(filePath).pipe(Effect.catchAll(() => Effect.succeed(false)));
        if (exists) {
          return filePath as string | null;
        }
      }
      return null as string | null;
    });

    /**
     * Reads a config file from disk and parses it as YAML or JSON.
     *
     * @param filePath - Absolute path to the config file
     * @param options - Optional settings (e.g. disableVersionCheck)
     * @returns The parsed config as a record
     */
    const readRawConfig = Effect.fn('RawConfigReader.readRawConfig')(function* (
      filePath: string,
      options?: { disableVersionCheck?: boolean }
    ) {
      const exists = yield* fs.exists(filePath).pipe(Effect.catchAll(() => Effect.succeed(false)));
      if (!exists) {
        return yield* Effect.fail(
          new ConfigFileNotFoundError({ message: `Config file not found at ${filePath}`, filePath })
        );
      }

      const fileContents = yield* fs
        .readFileString(filePath)
        .pipe(
          Effect.mapError(
            () => new ConfigFileParseError({ message: `Failed to read config file at ${filePath}`, filePath })
          )
        );

      if (fileContents.length === 0) {
        return yield* Effect.fail(
          new ConfigFileEmptyError({ message: `Config file is empty at ${filePath}`, filePath })
        );
      }

      const fileExtension = pathService.extname(filePath).toLowerCase();

      let parsed: Record<string, unknown>;
      try {
        if (fileExtension === '.json') {
          parsed = JSON.parse(fileContents) as Record<string, unknown>;
        } else if (['.yml', '.yaml'].includes(fileExtension)) {
          parsed = parseYaml(fileContents) as Record<string, unknown>;
        } else {
          parsed = parseYaml(fileContents) as Record<string, unknown>;
        }
      } catch (error) {
        return yield* Effect.fail(
          new ConfigFileParseError({
            message: `Failed to parse config file at ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            filePath,
            cause: error instanceof Error ? error.message : undefined,
          })
        );
      }

      if (parsed == null) {
        return yield* Effect.fail(
          new ConfigFileParseError({ message: `Config file could not be parsed at ${filePath}`, filePath })
        );
      }

      if (!options?.disableVersionCheck && typeof parsed.version !== 'number') {
        return yield* Effect.fail(
          new ConfigVersionError({ message: `Config file is missing version at ${filePath}`, filePath })
        );
      }

      return parsed;
    });

    /**
     * Convenience wrapper: reads and parses a config file, returning null if the file
     * does not exist. Version checking is disabled (used for Vercel build output files).
     *
     * @param configFilePath - Absolute path to the config file
     * @returns The parsed object cast to T, or null when not found
     */
    const readConfigFile = <T>(configFilePath: string) =>
      readRawConfig(configFilePath, { disableVersionCheck: true }).pipe(
        Effect.map((parsed) => parsed as unknown as T),
        Effect.catchTag('ConfigFileNotFoundError', () => Effect.succeed(null as T | null)),
        Effect.withSpan('RawConfigReader.readConfigFile')
      );

    return { findConfig, readRawConfig, readConfigFile };
  }),
}) {}

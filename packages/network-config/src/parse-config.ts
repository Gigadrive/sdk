import { Effect } from 'effect';
import { ConfigVersionError } from './errors';
import { filterFunctionsFromAssets } from './filter-functions-from-assets';
import type { NormalizedConfig } from './normalized-config';
import { RawConfigReader } from './services/raw-config-reader';
import { SchemaValidator } from './services/schema-validator';
import { V4ConfigParser } from './services/v4-config-parser';
import { VercelBuildOutputParser } from './services/vercel-build-output-parser';
import type { ConfigV4 } from './v4';
import schemaV4 from './v4/schema.json';

export interface Config {
  version: number;
  env?: Record<string, string>;
}

/**
 * Parses a config file at the given path and validates it against the appropriate
 * JSON Schema, returning a NormalizedConfig **without** post-processing.
 *
 * Use {@link parseConfig} when you also want Vercel BOv3 merging, empty-deployment
 * checks, and function/asset deduplication applied automatically.
 *
 * @param filePath - Absolute path to the config file
 * @param projectFolder - Absolute path to the project root
 */
export const parseConfigRaw = Effect.fn('parseConfigRaw')(function* (filePath: string, projectFolder: string) {
  const rawReader = yield* RawConfigReader;
  const validator = yield* SchemaValidator;
  const v4Parser = yield* V4ConfigParser;

  const parsed = yield* rawReader.readRawConfig(filePath);
  const version = parsed.version as number;

  const schemaMap: Record<number, object> = {
    4: schemaV4,
  };

  const schema = schemaMap[version];

  if (!schema) {
    return yield* Effect.fail(
      new ConfigVersionError({
        message: `Config file at ${filePath} has an unsupported version: ${version}`,
        filePath,
        version,
      })
    );
  }

  yield* validator.validate(parsed, schema, filePath);

  return yield* v4Parser.parse(parsed as unknown as ConfigV4, projectFolder);
});

/**
 * Parses a config file at the given path, validates it against the appropriate
 * JSON Schema, converts it to a NormalizedConfig, and applies post-processing.
 *
 * @param filePath - Absolute path to the config file
 * @param projectFolder - Absolute path to the project root
 */
export const parseConfig = Effect.fn('parseConfig')(function* (filePath: string, projectFolder: string) {
  const parseResult: NormalizedConfig = yield* parseConfigRaw(filePath, projectFolder);
  return yield* postProcessConfig(parseResult, projectFolder);
});

/**
 * Applies post-processing transformers to a NormalizedConfig:
 * - Vercel Build Output v3 (merges functions/routes from .vercel/output if present)
 * - Empty deployment validation
 * - Filter functions from assets
 *
 * @param config - The parsed NormalizedConfig
 * @param projectFolder - Absolute path to the project root
 * @returns The post-processed NormalizedConfig
 */
export const postProcessConfig = Effect.fn('postProcessConfig')(function* (
  config: NormalizedConfig,
  projectFolder: string
) {
  const vercelParser = yield* VercelBuildOutputParser;
  let result = yield* vercelParser.parse(config, projectFolder);

  // Stricter check first: no functions, no assets, AND no routes → error
  if (result.entrypoints.length === 0 && (result.assets?.paths?.length || 0) === 0 && result.routes.length === 0) {
    result.errors.push(
      'The current project config does not resolve to any functions, assets or routes and can not be deployed.'
    );
  } else if (result.entrypoints.length === 0 && (result.assets?.paths?.length || 0) === 0) {
    result.warnings.push('The current project does not have any functions or assets to deploy.');
  }

  result = filterFunctionsFromAssets(result);

  return result;
});

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';
import { parseVercelBuildOutputV3 } from './build-output-v3/parse';
import type { NormalizedConfig } from './normalized-config';
import { parseRawConfig } from './parse-raw-config';
import { parseConfigV4 } from './v4/parse';

const schemaV4 = JSON.parse(fs.readFileSync(path.join(__dirname, './v4/schema.json'), 'utf8'));

export const ALLOWED_CONFIG_NAMES = ['gigadrive.yaml', 'gigadrive.yml', 'nebula.yaml', 'nebula.yml', 'nebula.json'];

/**
 * Finds a config file in the project folder.
 * @param projectFolder The folder to search for a config file in.
 * @returns The path to the config file, or null if no config file is found.
 */
export const findConfig = (projectFolder: string): string | null => {
  for (const name of ALLOWED_CONFIG_NAMES) {
    const filePath = path.join(projectFolder, name);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
};

export const parseConfig = async (filePath: string, projectFolder: string): Promise<NormalizedConfig> => {
  const parsed = await parseRawConfig(filePath);
  const version = parsed.version;

  const schemaMap: Record<number, object> = {
    /*1: schemaV1,
      2: schemaV2,
      3: schemaV3,*/
    4: schemaV4,
  };

  // build the path to the config file relative to the project root (strip /tmp/unzipped prefix)
  const relativePath = filePath.replace('/tmp/unzipped/', '');

  const schema = schemaMap[version];

  if (!schema) {
    throw new Error(`Config file at ${relativePath} has an unsupported version: ${version}`);
  }

  // validate the config file
  const ajv = new Ajv();
  addFormats(ajv);

  const validate = ajv.compile(schema);

  const valid = validate(parsed);
  if (!valid) {
    throw new Error(`Config file at ${relativePath} is invalid: ${ajv.errorsText(validate.errors)}`);
  }

  // @ts-ignore
  const parserMap: Record<number, (config, projectFolder) => Promise<NormalizedConfig>> = {
    /*1: parseConfigV1,
    2: parseConfigV2,
    3: parseConfigV3,*/
    4: parseConfigV4,
  };

  let parseResult: NormalizedConfig = await parserMap[version](parsed, projectFolder);

  // TODO: apply transformers
  parseResult = await parseVercelBuildOutputV3(parseResult, projectFolder);

  // if the config does not resolve to any resources, warn the user
  if (parseResult.entrypoints.length === 0 && (parseResult.assets?.paths?.length || 0) === 0) {
    parseResult.warnings.push('The current project does not have any functions or assets to deploy.');
  } else if (
    parseResult.entrypoints.length === 0 &&
    (parseResult.assets?.paths?.length || 0) === 0 &&
    parseResult.routes.length === 0
  ) {
    parseResult.errors.push(
      'The current project config does not resolve to any functions, assets or routes and can not be deployed.'
    );
  }

  return parseResult;
};

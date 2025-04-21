import fs from 'fs/promises';
import path from 'path';
import { parse as parseYaml } from 'yaml';

export const parseRawConfig = async (
  filePath: string,
  { disableVersionCheck = false }: { disableVersionCheck?: boolean } = {}
): Promise<Record<string, unknown>> => {
  // check if the file exists
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`Config file not found at ${filePath}`);
  }

  // read the file
  const fileContents = await fs.readFile(filePath, 'utf8');

  if (fileContents.length === 0) {
    throw new Error(`Config file is empty at ${filePath}`);
  }

  // determine file type based on extension
  const fileExtension = path.extname(filePath).toLowerCase();

  // parse the file based on its extension
  let parsed;
  try {
    if (fileExtension === '.json') {
      parsed = JSON.parse(fileContents);
    } else if (['.yml', '.yaml'].includes(fileExtension)) {
      parsed = parseYaml(fileContents);
    } else {
      // Try to parse as YAML by default, which is more forgiving
      parsed = parseYaml(fileContents);
    }
  } catch (error) {
    throw new Error(
      `Failed to parse config file at ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  if (parsed === undefined) {
    throw new Error(`Config file could not be parsed at ${filePath}`);
  }

  // check if the version is present
  if (!disableVersionCheck && typeof parsed.version !== 'number') {
    throw new Error(`Config file is missing version at ${filePath}`);
  }

  return parsed;
};

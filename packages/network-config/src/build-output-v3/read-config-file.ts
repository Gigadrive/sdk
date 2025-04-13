import fs from 'fs';
import { parseRawConfig } from '../parse-raw-config';

/**
 * Reads and parses a configuration file at the specified path.
 *
 * @param configFilePath - The path to the configuration file to read
 * @returns The parsed configuration object, or null if the file doesn't exist
 * @template T - The type of the configuration object
 */
export const readConfigFile = async <T>(configFilePath: string): Promise<T | null> => {
  if (!fs.existsSync(configFilePath)) {
    // skip vercel transformation if no vercel output exists
    return null;
  }

  const parsed = await parseRawConfig(configFilePath, { disableVersionCheck: true });

  return parsed as T;
};

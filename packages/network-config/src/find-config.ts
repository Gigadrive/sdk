import fs from 'fs';
import path from 'path';

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

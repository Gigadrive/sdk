import fs from 'fs';
import path from 'path';

/**
 * Creates a mapping of absolute file paths to their relative paths
 * starting from the provided directory.
 *
 * This is the default path map that will be used for Vercel-based functions, when the function does not specify a filePathMap.
 *
 * @param directory - The absolute path of the directory to process
 * @returns A record where keys are absolute file paths and values are relative paths
 */
export const getDefaultPathMap = (directory: string): Record<string, string> => {
  const result: Record<string, string> = {};

  if (!fs.existsSync(directory)) {
    return result;
  }

  /**
   * Recursively processes a directory and adds file mappings to the result
   *
   * @param currentPath - The absolute path of the current directory being processed
   * @param basePath - The relative path accumulated during recursion
   */
  const processDirectory = (currentPath: string, basePath: string = '') => {
    const files = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(currentPath, file.name);
      const relativePath = path.join(basePath, file.name);

      if (file.isDirectory()) {
        processDirectory(fullPath, relativePath);
      } else {
        result[fullPath] = relativePath;
      }
    }
  };

  processDirectory(directory);
  return result;
};

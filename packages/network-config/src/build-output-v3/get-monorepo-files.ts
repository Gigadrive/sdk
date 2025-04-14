import { FilePathMap } from '../normalized-config';

/**
 * Returns files that are not part of the project directory
 * @param directory Absolute path of a directory
 * @param filePathMaps Array of file path maps for functions
 * @returns Array of file paths that are not within the directory
 */
export function getMonorepoFiles(directory: string, filePathMaps: FilePathMap[]): string[] {
  const result: string[] = [];

  for (const filePathMap of filePathMaps ?? []) {
    if (!filePathMap) {
      continue;
    }

    for (const file of Object.keys(filePathMap)) {
      if (!file.startsWith(directory)) {
        result.push(file);
      }
    }
  }

  return result;
}

import { minimatch } from 'minimatch';
import { readdir } from 'node:fs/promises';

/**
 * Gets paths to all files that match a certain pattern (glob or regex) in a given project folder.
 * @param pattern The pattern to match files against. Can be a glob or regex pattern.
 * @param projectFolder The folder to search for files in.
 * @param excludeFiles An array of file names, folder names, glob patterns or regex patterns to exclude from the search.
 */
export const getFilesForPattern = async (
  pattern: string,
  projectFolder: string,
  excludeFiles: string | string[] = []
): Promise<string[]> => {
  const files: string[] = [];
  const filesInFolder = await readdir(projectFolder, { recursive: true });
  const exactFiles = new Set(filesInFolder.filter((file): file is string => typeof file === 'string'));

  let regex: RegExp | null = null;

  if (!exactFiles.has(pattern)) {
    try {
      regex = new RegExp(`^(?:${pattern})$`);
    } catch {
      // ignored
    }
  }

  const finalExclusions = Array.isArray(excludeFiles) ? excludeFiles : [excludeFiles];

  for (const file of filesInFolder) {
    if (typeof file !== 'string') {
      continue;
    }

    if (
      finalExclusions.some((excludeFile) => {
        if (minimatch(file, excludeFile)) {
          return true;
        }

        if (!exactFiles.has(excludeFile)) {
          try {
            return new RegExp(`^(?:${excludeFile})$`).test(file);
          } catch {
            return false;
          }
        }

        return false;
      })
    ) {
      continue;
    }

    if (minimatch(file, pattern) || (regex != null && regex.test(file))) {
      files.push(file);
    }
  }

  return files;
};

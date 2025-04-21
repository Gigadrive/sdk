import path from 'path';
import { NormalizedConfig } from '../normalized-config';

/**
 * Determines the root of the repository based on the project folder and configuration.
 * Analyzes file paths in entrypoint packages to find the common root directory.
 *
 * @param projectFolder - The base folder path of the project
 * @param config - The normalized configuration that may contain entrypoints with file path maps
 * @returns The determined repository root path
 */
export const determineRepoRoot = (projectFolder: string, config: Partial<NormalizedConfig>): string => {
  // Default to project folder if no entrypoints or file paths
  if (!config.entrypoints?.length) {
    return projectFolder;
  }

  // Collect all file paths from entrypoints
  const filePaths: string[] = [];
  for (const entrypoint of config.entrypoints) {
    if (entrypoint.package?.filePathMap) {
      filePaths.push(...Object.keys(entrypoint.package.filePathMap));
    }
  }

  // If no file paths found, return project folder
  if (filePaths.length === 0) {
    return projectFolder;
  }

  // Get common path components
  const pathParts = filePaths.map((p) => p.split(path.sep));
  const firstPath = pathParts[0];

  const commonParts: string[] = [];
  for (let i = 0; i < firstPath.length; i++) {
    const part = firstPath[i];
    if (pathParts.every((parts) => parts[i] === part)) {
      commonParts.push(part);
    } else {
      break;
    }
  }

  // Join common parts to form the common root
  const commonRoot = commonParts.join(path.sep);

  // Only return common root if it's higher in the directory tree than the project folder
  // (i.e., project folder is a subdirectory of the common root)
  if (commonRoot && projectFolder.startsWith(commonRoot) && commonRoot !== projectFolder) {
    return commonRoot;
  }

  return projectFolder;
};

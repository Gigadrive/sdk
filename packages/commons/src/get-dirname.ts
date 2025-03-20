import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Gets the directory name from an import.meta.url or falls back to __dirname.
 *
 * This utility function helps determine the current directory path in both ESM and CommonJS environments.
 * In ESM, it converts the import.meta.url to a file path and extracts the directory.
 * In CommonJS, it falls back to the global __dirname variable.
 *
 * @param importMetaUrl - The import.meta.url string from an ES module
 * @returns The directory path as a string
 * @throws Error if the directory path cannot be determined
 *
 * @example
 * // In an ES module:
 * const dirname = getDirname(import.meta.url);
 */
export const getDirname = (importMetaUrl: string): string => {
  try {
    // Try ESM first
    const __filename = fileURLToPath(importMetaUrl);
    return path.dirname(__filename);
  } catch {
    // Fallback to CJS
    // Use globalThis to access global variables in a way that works in both CJS and ESM
    if (typeof globalThis.__dirname !== 'undefined') {
      return globalThis.__dirname;
    }
    throw new Error('Unable to determine directory path');
  }
};

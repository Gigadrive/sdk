import { getFilesForPattern } from '@gigadrive/build-utils';
import archiver from 'archiver';
import fs from 'fs';
import fsPromises from 'fs/promises';
import ignore, { type Ignore } from 'ignore';
import path from 'path';

const ignoreFileNames = [/*'.gitignore', */ '.gigadriveignore', '.vercelignore', '.dockerignore', '.nowignore'];

// Function to read and parse the ignore file
async function readIgnoreFile(ignorePath: string) {
  try {
    await fsPromises.access(ignorePath);
    const content = await fsPromises.readFile(ignorePath, 'utf8');
    return content.split('\n').filter((line: string) => line.trim() !== '');
  } catch {
    return [];
  }
}

// Collect ignore patterns from the given directory (including the root)
async function collectIgnorePatterns(dir: string, baseDir: string, ignoreRules: Ignore) {
  const items = await fsPromises.readdir(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const relativePath = path.relative(baseDir, fullPath);
    const stat = await fsPromises.lstat(fullPath);

    if (stat.isDirectory()) {
      // If the directory itself is ignored, skip it unless it has a negation rule
      if (ignoreRules.ignores(`${relativePath}/`)) {
        continue;
      }

      // Check if the directory contains an ignore file
      for (const ignoreFileName of ignoreFileNames) {
        const ignoreFilePath = path.join(fullPath, ignoreFileName);
        try {
          await fsPromises.access(ignoreFilePath);
          const patterns = (await readIgnoreFile(ignoreFilePath)).map((pattern: string) => {
            return pattern.startsWith('!')
              ? `!${path.join(relativePath, pattern.slice(1))}`
              : path.join(relativePath, pattern);
          });
          ignoreRules.add(patterns);
        } catch {
          // File doesn't exist, skip
        }
      }

      // Recurse into subdirectory
      await collectIgnorePatterns(fullPath, baseDir, ignoreRules);
    }
  }
}

// Function to initialize ignore rules including root-level ignore files
async function initializeIgnoreRules(baseDir: string): Promise<Ignore> {
  const ignoreRules = ignore();

  // Add default ignore rules
  ignoreRules.add(['.git/', '**/.DS_Store', '**/Thumbs.db']);

  // Process root-level ignore files
  for (const ignoreFileName of ignoreFileNames) {
    const ignoreFilePath = path.join(baseDir, ignoreFileName);
    try {
      await fsPromises.access(ignoreFilePath);
      const patterns = (await readIgnoreFile(ignoreFilePath)).map((pattern: string) => {
        return pattern.startsWith('!') ? `!${pattern.slice(1)}` : pattern;
      });
      ignoreRules.add(patterns);
    } catch {
      // File doesn't exist, skip
    }
  }

  // Recursively process all subdirectories to gather additional ignore patterns
  await collectIgnorePatterns(baseDir, baseDir, ignoreRules);

  return ignoreRules;
}

// Function to get all files and directories, excluding those in the ignore list
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getFilesToInclude(dir: string, ignoreRules: Ignore, whitelist?: string[]) {
  const filesToInclude: string[] = [];

  async function walkDir(currentDir: string) {
    const items = await fsPromises.readdir(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const relativePath = path.relative(dir, fullPath);
      const stat = await fsPromises.lstat(fullPath);

      if (stat.isDirectory()) {
        if (ignoreRules.ignores(`${relativePath}/`)) {
          continue;
        }
        await walkDir(fullPath);
      } else {
        if (!ignoreRules.ignores(relativePath)) {
          filesToInclude.push(fullPath);
        } else if (ignoreRules.ignores(relativePath) && ignoreRules.test(relativePath).unignored) {
          // Handle whitelisted files that were previously ignored
          filesToInclude.push(fullPath);
        }
      }
    }
  }

  await walkDir(dir);
  return filesToInclude;
}

// Function to create the zip archive
export async function createZipArchive(
  inputDir: string,
  outputFile: string,
  options: {
    whitelist?: string[];
    useIgnoreFiles?: boolean;
    useManagedIgnore?: boolean;
  } = {}
) {
  const ignoreRules = options.useIgnoreFiles !== false ? await initializeIgnoreRules(inputDir) : ignore();

  // Get list of files to include in the zip
  const filesToInclude = options.whitelist
    ? await Promise.all(options.whitelist.map((file) => getFilesForPattern(inputDir, file)))
    : await getFilesToInclude(inputDir, ignoreRules);

  // Create zip file
  const output = fs.createWriteStream(outputFile);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise<void>((resolve, reject) => {
    output.on('close', () => resolve());
    archive.on('error', reject);

    archive.pipe(output);

    // Add files to the archive
    for (const file of filesToInclude.flat()) {
      archive.file(file, { name: path.relative(inputDir, file) });
    }

    void archive.finalize();
  });
}

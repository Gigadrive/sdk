import { getFilesForPattern } from '@gigadrive/build-utils';
import archiver from 'archiver';
import fs from 'fs';
import ignore, { type Ignore } from 'ignore';
import path from 'path';

const ignoreFileNames = [/*'.gitignore', */ '.gigadriveignore', '.vercelignore', '.dockerignore', '.nowignore'];

// Function to read and parse the ignore file
function readIgnoreFile(ignorePath: string) {
  if (fs.existsSync(ignorePath)) {
    return fs
      .readFileSync(ignorePath, 'utf8')
      .split('\n')
      .filter((line) => line.trim() !== '');
  }
  return [];
}

// Collect ignore patterns from the given directory (including the root)
function collectIgnorePatterns(dir: string, baseDir: string, ignoreRules: Ignore) {
  const items = fs.readdirSync(dir);

  items.forEach((item) => {
    const fullPath = path.join(dir, item);
    const relativePath = path.relative(baseDir, fullPath);
    const stat = fs.lstatSync(fullPath);

    if (stat.isDirectory()) {
      // If the directory itself is ignored, skip it unless it has a negation rule
      if (ignoreRules.ignores(`${relativePath}/`)) {
        return;
      }

      // Check if the directory contains an ignore file
      ignoreFileNames.forEach((ignoreFileName) => {
        const ignoreFilePath = path.join(fullPath, ignoreFileName);
        if (fs.existsSync(ignoreFilePath)) {
          const patterns = readIgnoreFile(ignoreFilePath).map((pattern) => {
            return pattern.startsWith('!')
              ? `!${path.join(relativePath, pattern.slice(1))}`
              : path.join(relativePath, pattern);
          });
          ignoreRules.add(patterns);
        }
      });

      // Recurse into subdirectory
      collectIgnorePatterns(fullPath, baseDir, ignoreRules);
    }
  });
}

// Function to initialize ignore rules including root-level ignore files
function initializeIgnoreRules(baseDir: string): Ignore {
  const ignoreRules = ignore();

  // Add default ignore rules
  ignoreRules.add(['.git/', '**/.DS_Store', '**/Thumbs.db']);

  // Process root-level ignore files
  ignoreFileNames.forEach((ignoreFileName) => {
    const ignoreFilePath = path.join(baseDir, ignoreFileName);
    if (fs.existsSync(ignoreFilePath)) {
      const patterns = readIgnoreFile(ignoreFilePath).map((pattern) => {
        return pattern.startsWith('!') ? `!${pattern.slice(1)}` : pattern;
      });
      ignoreRules.add(patterns);
    }
  });

  // Recursively process all subdirectories to gather additional ignore patterns
  collectIgnorePatterns(baseDir, baseDir, ignoreRules);

  return ignoreRules;
}

// Function to get all files and directories, excluding those in the ignore list
async function getFilesToInclude(dir: string, ignoreRules: Ignore, whitelist?: string[]) {
  const filesToInclude: string[] = [];

  function walkSync(currentDir: string) {
    const items = fs.readdirSync(currentDir);

    items.forEach((item) => {
      const fullPath = path.join(currentDir, item);
      const relativePath = path.relative(dir, fullPath);
      const stat = fs.lstatSync(fullPath);

      if (stat.isDirectory()) {
        if (ignoreRules.ignores(`${relativePath}/`)) {
          //console.debug(`Ignoring directory: ${relativePath}/`);
          return;
        }
        walkSync(fullPath);
      } else {
        if (!ignoreRules.ignores(relativePath)) {
          filesToInclude.push(fullPath);
        } else if (ignoreRules.ignores(relativePath) && ignoreRules.test(relativePath).unignored) {
          // Handle whitelisted files that were previously ignored
          filesToInclude.push(fullPath);
        } else {
          //console.debug(`Ignoring file: ${relativePath}`);
        }
      }
    });
  }

  walkSync(dir);
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
  const ignoreRules = options.useIgnoreFiles !== false ? initializeIgnoreRules(inputDir) : ignore();

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
    filesToInclude.forEach((file) => {
      archive.file(file, { name: path.relative(inputDir, file) });
    });

    archive.finalize();
  });
}

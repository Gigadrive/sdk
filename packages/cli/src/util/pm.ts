import fs from 'fs';
import path from 'path';
import { exec } from '../../../build-utils/src/exec';

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

/**
 * Detects the package manager to use for a specific directory
 */
export const getPackageManager = async ({ cwd }: { cwd: string }): Promise<PackageManager | null> => {
  // check if package.json exists
  const packageJsonPath = path.join(cwd, 'package.json');

  // If package.json does not exist, return null
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  // Check if yarn lock exists
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) {
    return 'yarn';
  }

  // Check if pnpm lock exists
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }

  // Check if bun lock exists
  if (fs.existsSync(path.join(cwd, 'bun.lockb'))) {
    return 'bun';
  }

  // Check if pnpm lock exists
  if (fs.existsSync(path.join(cwd, 'package-lock.json'))) {
    return 'npm';
  }

  // Check if bun is installed
  try {
    await exec({ command: 'bun --version', cwd });
    return 'bun';
  } catch {
    // If bun is not installed, return npm
    return 'npm';
  }
};

export const installCommand = (pm: PackageManager) => {
  return (
    {
      bun: 'bun install',
      npm: 'npm install',
      pnpm: 'pnpm install',
      yarn: 'yarn install',
    }[pm] || 'npm install'
  );
};

export const buildCommand = (pm: PackageManager) => {
  return (
    {
      bun: 'bun run build',
      npm: 'npm run build',
      pnpm: 'pnpm build',
      yarn: 'yarn build',
    }[pm] || 'npm run build'
  );
};

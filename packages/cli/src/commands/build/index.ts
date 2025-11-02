import { error, log } from '@/util/log';
import { exec } from '@gigadrive/build-utils';
import type { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { buildCommand, getPackageManager, installCommand } from '../../util/pm';

export const build = (parent: Command) => {
  parent
    .command('build')
    .description('Build the current project')
    .action(async () => {
      // Set relevant environment variables
      const env = {
        ...process.env,
        NODE_ENV: 'production',
        NEBULA: '1',
        VERCEL: '1', // Vercel compatibility
        NOW_BUILDER: '1',
      };

      const cwd = process.cwd();

      const packageJsonPath = path.join(cwd, 'package.json');

      if (!fs.existsSync(packageJsonPath)) {
        error('No package.json found');
        return;
      }

      // Read package.json and check for build scripts
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      const buildScript = packageJson.scripts?.build;

      // If build script is not defined, return null
      if (!buildScript) {
        error('No build script found in package.json');
        return;
      }

      const packageManager = await getPackageManager({ cwd });

      if (!packageManager) {
        error('No package manager found');
        return;
      }

      await exec({
        command: installCommand(packageManager),
        cwd,
        env,
        onOutput: (chunk) => {
          log(chunk);
        },
      });

      await exec({
        command: buildCommand(packageManager),
        cwd,
        env,
        onOutput: (chunk) => {
          log(chunk);
        },
      });
    });
};

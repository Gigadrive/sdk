import type { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { getPackageManager, installCommand } from '../../util/pm';

export const install = (parent: Command) => {
  parent
    .command('install')
    .description('Installs dependencies for the current project')
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
        console.log('No package.json found');
        return;
      }

      const packageManager = await getPackageManager({ cwd });

      if (!packageManager) {
        console.log('No package manager found');
        return;
      }

      const { stdout } = Bun.spawn([...installCommand(packageManager).split(' ')], {
        env,
        cwd,
      });

      // @ts-ignore
      for await (const chunk of stdout) {
        console.log(new TextDecoder().decode(chunk));
      }
    });
};

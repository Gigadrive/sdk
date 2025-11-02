import type { Command } from 'commander';
import { authManager } from '../../auth/manager';

export const whoami = (program: Command) => {
  program
    .command('whoami')
    .description('Show the currently authenticated user information')
    .action(async () => {
      try {
        const info = await authManager.getUserInfo();
        if (!info) {
          console.log('You are not logged in. Run "gigadrive login" to authenticate.');
          return;
        }
        // Pretty-print the user info JSON
        console.log(JSON.stringify(info, null, 2));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Failed to retrieve user info: ${msg}`);
      }
    });
};

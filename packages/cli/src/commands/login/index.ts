import type { Command } from 'commander';
import { authManager } from '../../auth/manager';

export const login = (program: Command) => {
  program
    .command('login')
    .description('Login to the platform')
    .action(async () => {
      console.log('Initiating login...');
      const success = await authManager.login();
      if (success) {
        console.log('You are now logged in!');
      } else {
        console.error('Login failed. Please try again.');
      }
    });
};

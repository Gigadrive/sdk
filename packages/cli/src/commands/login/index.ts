import { authManager } from '@/auth/manager';
import { error, log, success } from '@/util/log';
import type { Command } from 'commander';

export const login = (program: Command) => {
  program
    .command('login')
    .description('Login to the platform')
    .action(async () => {
      log('Initiating login...');
      const result = await authManager.login();
      if (result) {
        // Fetch user info for a friendly success message
        try {
          const info = (await authManager.getUserInfo()) ?? {};
          const isNonEmptyString = (value: unknown): value is string =>
            typeof value === 'string' && value.trim() !== '';
          const nameField = (info as Record<string, unknown>).name;
          const givenNameField = (info as Record<string, unknown>).given_name;
          const familyNameField = (info as Record<string, unknown>).family_name;
          const preferredUsernameField = (info as Record<string, unknown>).preferred_username;
          const emailField = (info as Record<string, unknown>).email;

          const inferredName =
            (isNonEmptyString(nameField) && nameField) ||
            (isNonEmptyString(givenNameField) && isNonEmptyString(familyNameField)
              ? `${givenNameField} ${familyNameField}`
              : undefined) ||
            (isNonEmptyString(preferredUsernameField) && preferredUsernameField) ||
            (isNonEmptyString(emailField) && emailField) ||
            'your account';

          success(`You are now logged in as ${inferredName}.`);
        } catch {
          // Fallback if userinfo fails
          success('You are now logged in.');
        }
      } else {
        error('Login failed. Please try again.');
      }
    });
};

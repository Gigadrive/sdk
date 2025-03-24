import { findConfig, parseConfig } from '@gigadrive/network-config';
import { Command } from 'commander';
import { log } from 'console';
import { debug } from '../../../util/log';

export const config = (parent: Command) => {
  parent
    .command('config')
    .description('Provide debug info about the project configuration in the current directory')
    .action(async () => {
      const configPath = findConfig(process.cwd());

      if (!configPath) {
        debug('No config file found');
        throw new Error('The current project folder does not have a valid config file.');
      }

      const config = await parseConfig(configPath, process.cwd());

      log(`Config file found at: ${configPath}`);
      log(JSON.stringify(config, null, 2));
    });
};

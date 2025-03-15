import type { Command } from 'commander';
import { deploy as demoDeploy } from './demo-deploy';
import { deploy } from './deploy';

export const platform = (program: Command) => {
  const platform = program.command('platform').description('Manage the platform');

  // register subcommands
  deploy(platform);
  demoDeploy(platform);
};

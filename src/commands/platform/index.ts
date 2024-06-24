import type { Command } from 'commander';
import { build } from '../build';

export const platform = (program: Command) => {
  const platform = program.command('platform').description('Manage the platform');

  // register subcommands
  build(platform);
};

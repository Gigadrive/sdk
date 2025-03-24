import type { Command } from 'commander';
import { config } from './config';

export const debug = (program: Command) => {
  const debug = program.command('debug').description('Provides various debugging utilities');

  // register subcommands
  config(debug);
};

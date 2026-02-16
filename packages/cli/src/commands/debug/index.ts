import { Command } from '@effect/cli';
import { Effect } from 'effect';
import { debugConfigCommand } from './config';

const debugBase = Command.make('debug', {}, () => Effect.void);

export const debugCommand = debugBase.pipe(Command.withSubcommands([debugConfigCommand]));

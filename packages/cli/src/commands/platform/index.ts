import { Command } from '@effect/cli';
import { Effect } from 'effect';
import { deployCommand } from './deploy';

const platformBase = Command.make('platform', {}, () => Effect.void);

export const platformCommand = platformBase.pipe(Command.withSubcommands([deployCommand]));

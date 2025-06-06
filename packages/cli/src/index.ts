import { Command } from 'commander';
import { build } from './commands/build';
import { debug } from './commands/debug';
import { platform } from './commands/platform';
import { error, log, setVerbose } from './util/log';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let { isTTY } = process.stdout;
//process.stdin.resume();

const main = async () => {
  if (process.env.FORCE_TTY === '1') {
    isTTY = true;
    process.stdout.isTTY = true;
    process.stdin.isTTY = true;
  }

  let exitCode = 0;

  const program = new Command();

  program.option('-v, --verbose', 'Enable verbose logging', false);

  program.hook('preSubcommand', (thisCommand) => {
    setVerbose((thisCommand.opts().verbose as boolean) === true);

    if (thisCommand.opts().verbose) {
      log('Using verbose mode');
    }
  });

  program.hook('preAction', (thisCommand) => {
    setVerbose((thisCommand.opts().verbose as boolean) === true);
  });

  // register commands
  platform(program);
  debug(program);
  build(program);

  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    error(err as string | number | boolean | object);
    exitCode = 1;
  }

  return exitCode;
};

const handleRejection = (err: unknown) => {
  if (err) {
    if (err instanceof Error) {
      handleUnexpected(err);
    } else {
      console.error(`An unexpected rejection occurred\n  ${JSON.stringify(err)}`);
    }
  } else {
    console.error('An unexpected empty rejection occurred');
  }

  process.exit(1);
};

const handleUnexpected = (error: Error) => {
  const { message } = error;

  console.error(`An unexpected error occurred\n  ${message}`);

  process.exit(1);
};

process.on('unhandledRejection', handleRejection);
process.on('uncaughtException', handleUnexpected);

process.on('exit', () => {
  const terminal = process.stderr.isTTY ? process.stderr : process.stdout.isTTY ? process.stdout : undefined;
  terminal?.write('\u001B[?25h');
});

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch(handleUnexpected);

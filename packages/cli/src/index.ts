import { Command } from 'commander';
import { build } from './commands/build';
import { platform } from './commands/platform';
import { error, setVerbose } from './util/log';

let { isTTY } = process.stdout;
//process.stdin.resume();

const main = async () => {
  if (process.env.FORCE_TTY === '1') {
    isTTY = true;
    process.stdout.isTTY = true;
    process.stdin.isTTY = true;
  }

  let exitCode = 0;

  const program = new Command().hook('preAction', (thisCommand) => {
    setVerbose(thisCommand.opts().verbose as boolean);
  });

  program.option('-v, --verbose', 'Enable verbose logging');

  // register service commands
  platform(program);

  // register general commands
  build(program);

  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    error(err);
    exitCode = 1;
  }

  return exitCode;
};

const handleRejection = async (err: any) => {
  if (err) {
    if (err instanceof Error) {
      await handleUnexpected(err);
    } else {
      // eslint-disable-next-line no-console
      console.error(`An unexpected rejection occurred\n  ${err}`);
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
  .then(async (exitCode) => {
    process.exitCode = exitCode;
  })
  .catch(handleUnexpected);

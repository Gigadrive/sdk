import { Command } from 'commander';
import { build } from './commands/build';
import { install } from './commands/install';
import { platform } from './commands/platform';

let { isTTY } = process.stdout;

const main = async () => {
  if (process.env.FORCE_TTY === '1') {
    isTTY = true;
    process.stdout.isTTY = true;
    process.stdin.isTTY = true;
  }

  let exitCode;

  const program = new Command();

  // register service commands
  platform(program);

  // register general commands
  build(program);
  install(program);

  await program.parseAsync(process.argv);

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

  process.exit(1);
};

process.on('unhandledRejection', handleRejection);
process.on('uncaughtException', handleUnexpected);

main()
  .then(async (exitCode) => {
    process.exitCode = exitCode;
  })
  .catch(handleUnexpected);

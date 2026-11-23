import pkg from '../package.json';

/**
 * Entry point of the `gigadrive` CLI. `--version` answers here, before the
 * command tree and its dependencies load; everything else loads `./main`.
 */
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--version') {
  process.stdout.write(`${pkg.version}\n`);
} else {
  void import('./main');
}

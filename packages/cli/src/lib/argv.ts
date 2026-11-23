/**
 * Command-line arguments as the user typed them, rewritten into the shape
 * `@effect/cli` parses. Pure, so it is tested without running the CLI.
 */

/** `--name=value` or `-n=value`. */
const INLINE_VALUE = /^(--[A-Za-z][\w-]*|-[A-Za-z])=([\s\S]*)$/;

/** Global options the CLI only accepts before the first subcommand. */
const GLOBAL_OPTIONS_WITH_VALUE = new Set(['--log-level']);

/** Result of {@link normalizeArgv}. */
export interface NormalizedArgv {
  /** `process.argv` with the rewrites applied, the node and script paths first. */
  readonly argv: string[];
  /** The `--log-level` value, when one was given. */
  readonly logLevel: string | undefined;
}

/**
 * Rewrites `process.argv` so every option reaches the parser:
 *
 * - `--port=8080` and `-p=8080` become `--port 8080` and `-p 8080`. The parser
 *   would otherwise refuse the first and could drop the second.
 * - Global options such as `--log-level debug` move before the subcommand as
 *   `--log-level=debug`, the one form the parser reliably accepts, so
 *   `gigadrive apps create -o x --log-level debug` works like
 *   `gigadrive --log-level=debug apps create -o x`.
 *
 * Nothing after a `--` separator is touched: those are the arguments of a
 * command run in a microVM.
 *
 * @param argv - `process.argv`: node, the script, then the arguments.
 */
export const normalizeArgv = (argv: ReadonlyArray<string>): NormalizedArgv => {
  const [node = 'node', script = 'gigadrive', ...rest] = argv;
  const separator = rest.indexOf('--');
  const options = separator === -1 ? rest : rest.slice(0, separator);
  const passthrough = separator === -1 ? [] : rest.slice(separator);

  const split: string[] = [];
  for (const token of options) {
    const match = INLINE_VALUE.exec(token);
    if (match) split.push(match[1], match[2]);
    else split.push(token);
  }

  const globals: string[] = [];
  const remaining: string[] = [];
  let logLevel: string | undefined;
  for (let index = 0; index < split.length; index += 1) {
    const token = split[index];
    if (GLOBAL_OPTIONS_WITH_VALUE.has(token) && index + 1 < split.length) {
      const value = split[index + 1];
      // One token: the parser reads `--log-level debug` before a subcommand
      // as the option and a subcommand named "debug", but `--log-level=debug`
      // as intended.
      globals.push(`${token}=${value}`);
      if (token === '--log-level') logLevel = value;
      index += 1;
      continue;
    }
    remaining.push(token);
  }

  return { argv: [node, script, ...globals, ...remaining, ...passthrough], logLevel };
};

/** Whether a `--log-level` value asks for debug output, which includes stack traces. */
export const isDebugLogLevel = (logLevel: string | undefined) =>
  logLevel === 'debug' || logLevel === 'trace' || logLevel === 'all';

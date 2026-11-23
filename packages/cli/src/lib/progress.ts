/**
 * A progress line on stderr for long waits, such as a microVM waiting for
 * capacity. It never writes to stdout, so `--json` output stays parseable.
 */

/** Where progress goes: `process.stderr`, or a fake in tests. */
export interface ProgressStream {
  readonly isTTY?: boolean;
  /** Terminal width; a line is cut to fit so rewriting it in place never leaves a wrapped half behind. */
  readonly columns?: number;
  write(text: string): unknown;
}

/** How long a non-terminal stream waits between repeats of an unchanged line. */
const REPEAT_EVERY_MS = 15_000;

/** `42s`, `3m 05s`. */
export const formatElapsed = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
};

/**
 * Reports a wait. On a terminal the line is rewritten in place; elsewhere (a
 * log file, CI) a line is printed when the message changes and every 15
 * seconds while it does not.
 */
export const createProgress = (stream: ProgressStream = process.stderr) => {
  const tty = stream.isTTY === true;
  let lastMessage: string | undefined;
  let lastPrintedAt = -Infinity;
  let open = false;
  return {
    /** Shows `message (elapsed)`. */
    update(message: string, elapsedMs: number) {
      const line = `${message} (${formatElapsed(elapsedMs)})`;
      if (tty) {
        const width = stream.columns ?? 0;
        stream.write(`\r\u001b[2K${width > 1 && line.length >= width ? `${line.slice(0, width - 2)}…` : line}`);
        open = true;
      } else if (message !== lastMessage || elapsedMs - lastPrintedAt >= REPEAT_EVERY_MS) {
        stream.write(`${line}\n`);
        lastPrintedAt = elapsedMs;
      }
      lastMessage = message;
    },
    /** Ends the line, so what follows starts on a fresh one. */
    done() {
      if (open) stream.write('\r\u001b[2K');
      open = false;
    },
  };
};

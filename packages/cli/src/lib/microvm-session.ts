import type { Command, CommandInfo, CommandStream } from '@gigadrive/sdk';
import { StdinBatcher } from './microvm';

/**
 * The local side of an attached remote command: where input comes from and
 * output goes to. {@link nodeSessionIo} wires it to the process; tests pass
 * fakes.
 */
export interface SessionIo {
  /** Subscribes to local input and its end. Returns an unsubscribe function. */
  readonly onInput: (listener: (chunk: Uint8Array) => void, onEnd: () => void) => () => void;
  /** Writes remote output. */
  readonly write: (data: Uint8Array, stream: CommandStream) => void;
  /** The local terminal size, when there is a terminal. */
  readonly size: () => { readonly cols: number; readonly rows: number } | undefined;
  /** Subscribes to terminal resizes (SIGWINCH). Returns an unsubscribe function. */
  readonly onResize: (listener: () => void) => () => void;
}

/** Options of {@link attachCommand}. */
export interface AttachOptions {
  /** Forward local input to the command's stdin. */
  readonly forwardInput: boolean;
  /** Close the command's stdin when local input ends (not for PTYs, where Ctrl-D is a byte). */
  readonly endInputOnEof: boolean;
  /** Propagate terminal resizes to a PTY command. */
  readonly forwardResize: boolean;
}

/**
 * Streams a remote command's output to `io` until it exits, forwarding local
 * input in batches (one request at a time, in order) and terminal resizes.
 *
 * @returns The command's final state.
 */
export async function attachCommand(command: Command, io: SessionIo, options: AttachOptions): Promise<CommandInfo> {
  const batcher = new StdinBatcher((data) => command.write(data), {
    // Input after the command exited is expected to fail; nothing to report.
    onError: () => undefined,
  });
  const cleanups: Array<() => void> = [];

  if (options.forwardInput) {
    cleanups.push(
      io.onInput(
        (chunk) => batcher.push(chunk),
        () => {
          if (!options.endInputOnEof) return;
          void batcher
            .close()
            .then(() => command.end())
            .catch(() => undefined);
        }
      )
    );
  }
  if (options.forwardResize) {
    cleanups.push(
      io.onResize(() => {
        const size = io.size();
        if (size) void command.resize(size.cols, size.rows).catch(() => undefined);
      })
    );
  }

  try {
    for await (const chunk of command.logs()) io.write(chunk.data, chunk.stream);
  } finally {
    for (const cleanup of cleanups) cleanup();
    await batcher.close();
  }
  return command.status === 'exited' ? command.info : await command.wait();
}

/** {@link SessionIo} on the process's stdin, stdout and stderr. */
export const nodeSessionIo = (): SessionIo => ({
  onInput: (listener, onEnd) => {
    const encoder = new TextEncoder();
    const onData = (chunk: Uint8Array | string) => listener(typeof chunk === 'string' ? encoder.encode(chunk) : chunk);
    process.stdin.on('data', onData);
    process.stdin.on('end', onEnd);
    process.stdin.resume();
    return () => {
      process.stdin.off('data', onData);
      process.stdin.off('end', onEnd);
      process.stdin.pause();
    };
  },
  write: (data, stream) => {
    (stream === 'stderr' ? process.stderr : process.stdout).write(data);
  },
  size: () => (process.stdout.isTTY ? { cols: process.stdout.columns, rows: process.stdout.rows } : undefined),
  onResize: (listener) => {
    process.stdout.on('resize', listener);
    return () => {
      process.stdout.off('resize', listener);
    };
  },
});

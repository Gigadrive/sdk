import { durationToMs, type MicroVmDuration } from './duration';
import { CommandFailedError, MicroVmTimeoutError } from './errors';
import type { MicroVmCommandsResource } from './resource';
import type { CommandInfo, CommandSignal, CommandStream } from './types';

/** One chunk of command output. */
export interface CommandLogChunk {
  /** `stdout` or `stderr`. PTY commands write everything to `stdout`. */
  stream: CommandStream;
  /** The raw bytes. */
  data: Uint8Array;
  /**
   * The bytes decoded as UTF-8. A multi-byte character split across two
   * chunks is completed in the later chunk, so concatenating `text` is safe.
   */
  text: string;
  /** Absolute byte offset of the chunk in its stream. */
  offset: number;
}

/** Options of {@link Command.logs}. */
export interface CommandLogsOptions {
  /** Keep streaming until the command exits. Default `true`; `false` returns what is buffered. */
  follow?: boolean;
  /** Start at these absolute offsets instead of the beginning of the retained output. */
  stdoutOffset?: number;
  stderrOffset?: number;
  /** Stops the stream; the iterator then throws the abort reason. */
  signal?: AbortSignal;
}

/** Options of {@link Command.wait}. */
export interface CommandWaitOptions {
  /** Give up after this long (milliseconds or `'5m'`). Default: wait indefinitely. */
  timeout?: MicroVmDuration;
  /** Throw {@link CommandFailedError} when the command exits non-zero or is killed. */
  throwOnError?: boolean;
  signal?: AbortSignal;
}

/** Receives output while a command runs. Returning a promise applies backpressure. */
export type CommandOutputCallback = (text: string, chunk: CommandLogChunk) => void | Promise<void>;

/** Longest single wait the API accepts. */
const MAX_WAIT_MS = 60_000;

const toMs = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const ms = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

/** Wall-clock duration of a finished command, when the API reports both times. @internal */
export const commandDurationMs = (info: CommandInfo): number | null => {
  const started = toMs(info.startedAt);
  const finished = toMs(info.finishedAt);
  return started !== null && finished !== null ? Math.max(0, finished - started) : null;
};

/**
 * A command running (or finished) inside a microVM. Get one from
 * {@link MicroVM.spawn} or reattach with `vm.commands.get(id)`.
 *
 * Output stays in the microVM (the last 8 MiB of each stream), so any number
 * of {@link logs} readers can replay it, from any process, and a dropped
 * connection resumes where it stopped.
 *
 * @example
 * ```ts
 * const server = await vm.spawn('node', ['server.js']);
 * for await (const chunk of server.logs()) {
 *   process.stdout.write(chunk.text);
 *   if (chunk.text.includes('listening')) break;
 * }
 * await vm.waitForPort(3000);
 * await server.kill();
 * ```
 */
export class Command {
  private current: CommandInfo;
  private pump: Promise<void> | undefined;
  private pumpError: unknown;

  /** @internal Use {@link MicroVM.spawn} or `vm.commands.get(id)`. */
  constructor(
    private readonly resource: MicroVmCommandsResource,
    /** The microVM this command runs in. */
    readonly microvmId: string,
    info: CommandInfo
  ) {
    this.current = info;
  }

  /** Command id (`cmd_...`). Pass it to `vm.commands.get(id)` to reattach later. */
  get id(): string {
    return this.current.id;
  }

  /** The latest known state. Updated by {@link refresh}, {@link wait} and the end of {@link logs}. */
  get info(): CommandInfo {
    return this.current;
  }

  get status(): CommandInfo['status'] {
    return this.current.status;
  }

  /** Exit code once exited; `null` while running or when a signal killed it. */
  get exitCode(): number | null {
    return this.current.exitCode;
  }

  /** Signal that killed the process, if any. */
  get signal(): string | null {
    return this.current.signal;
  }

  get pid(): number | null {
    return this.current.pid;
  }

  /** Fetch the latest state from the API. */
  async refresh(): Promise<CommandInfo> {
    this.current = await this.resource.get(this.microvmId, this.id);
    return this.current;
  }

  /**
   * Stream the command's output, from the beginning of the retained output by
   * default, until it exits. Reconnects transparently after a dropped
   * connection. Breaking out of the loop closes the stream; the command keeps
   * running.
   *
   * @example
   * ```ts
   * for await (const { stream, text } of command.logs()) {
   *   (stream === 'stdout' ? process.stdout : process.stderr).write(text);
   * }
   * ```
   */
  async *logs(options: CommandLogsOptions = {}): AsyncGenerator<CommandLogChunk> {
    const decoders: Record<CommandStream, TextDecoder> = { stdout: new TextDecoder(), stderr: new TextDecoder() };
    for await (const event of this.resource.logs(this.microvmId, this.id, options)) {
      if (event.type === 'exit') {
        this.current = { ...this.current, status: 'exited', exitCode: event.exitCode, signal: event.signal };
        continue;
      }
      const text = decoders[event.stream].decode(event.data, { stream: true });
      yield { stream: event.stream, data: event.data, text, offset: event.offset };
    }
  }

  /**
   * Collect the output from the start until the command exits.
   *
   * @example
   * ```ts
   * const { stdout } = await (await vm.spawn('ls', ['-la'])).output();
   * ```
   */
  async output(options: Pick<CommandLogsOptions, 'signal'> = {}): Promise<{ stdout: string; stderr: string }> {
    let stdout = '';
    let stderr = '';
    for await (const chunk of this.logs(options)) {
      if (chunk.stream === 'stdout') stdout += chunk.text;
      else stderr += chunk.text;
    }
    return { stdout, stderr };
  }

  /** The complete stdout as text, once the command exited. */
  async stdout(options: Pick<CommandLogsOptions, 'signal'> = {}): Promise<string> {
    return (await this.output(options)).stdout;
  }

  /** The complete stderr as text, once the command exited. */
  async stderr(options: Pick<CommandLogsOptions, 'signal'> = {}): Promise<string> {
    return (await this.output(options)).stderr;
  }

  /**
   * Wait for the command to exit and return its final state. Output callbacks
   * given to `spawn` have received all output when this resolves.
   *
   * @throws {@link MicroVmTimeoutError} when `timeout` elapses first (the command keeps running).
   * @throws {@link CommandFailedError} with `throwOnError` when it exits non-zero or is killed.
   */
  async wait(options: CommandWaitOptions = {}): Promise<CommandInfo> {
    const deadline = options.timeout === undefined ? Infinity : Date.now() + durationToMs(options.timeout);
    while (this.current.status !== 'exited') {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new MicroVmTimeoutError(`The command ${this.id} is still running; gave up waiting.`);
      }
      this.current = await this.resource.wait(this.microvmId, this.id, {
        timeoutMs: Math.min(MAX_WAIT_MS, remaining),
        signal: options.signal,
      });
    }
    if (this.pump) {
      await this.pump;
      if (this.pumpError !== undefined) throw this.pumpError;
    }
    if (options.throwOnError && this.current.exitCode !== 0) {
      throw CommandFailedError.fromInfo(this.current);
    }
    return this.current;
  }

  /**
   * Send a signal to the command's process group. Default `SIGTERM`; use
   * `SIGKILL` to stop it unconditionally.
   */
  async kill(signal: CommandSignal = 'SIGTERM'): Promise<void> {
    await this.resource.signal(this.microvmId, this.id, signal);
  }

  /**
   * Write to stdin. The command must have been spawned with `stdin: true` or a `pty`.
   *
   * @example
   * ```ts
   * const cat = await vm.spawn('cat', [], { stdin: true });
   * await cat.write('hello\n');
   * await cat.end();
   * console.log(await cat.stdout()); // "hello\n"
   * ```
   */
  async write(data: string | Uint8Array): Promise<void> {
    await this.resource.stdin(this.microvmId, this.id, data);
  }

  /** Close stdin, optionally writing a last piece of data first. */
  async end(data: string | Uint8Array = new Uint8Array(0)): Promise<void> {
    await this.resource.stdin(this.microvmId, this.id, data, { eof: true });
  }

  /** Resize the terminal of a PTY command. */
  async resize(cols: number, rows: number): Promise<void> {
    await this.resource.resize(this.microvmId, this.id, { cols, rows });
  }

  /** JSON form: the command's latest state. */
  toJSON(): CommandInfo {
    return this.current;
  }

  /**
   * Deliver output to callbacks in the background, for `spawn` with
   * `onStdout`/`onStderr`. {@link wait} waits for it and rethrows its error.
   *
   * @internal
   */
  startOutputPump(onStdout: CommandOutputCallback | undefined, onStderr: CommandOutputCallback | undefined): void {
    this.pump = (async () => {
      for await (const chunk of this.logs()) {
        await (chunk.stream === 'stdout' ? onStdout : onStderr)?.(chunk.text, chunk);
      }
    })().catch((error: unknown) => {
      this.pumpError = error;
    });
  }
}

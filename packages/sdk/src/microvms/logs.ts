import { ApiError } from '../errors';
import { base64ToBytes } from '../queues/encoding';
import { parseSSEEvents } from '../streaming';
import { sleep } from './duration';
import type { CommandLogEvent, CommandStream } from './types';

/** Options of a resumable command log stream. */
export interface CommandLogStreamOptions {
  /** Keep streaming until the command exits. Default `true`. */
  follow?: boolean;
  /** Absolute stdout offset to start from. Default 0. */
  stdoutOffset?: number;
  /** Absolute stderr offset to start from. Default 0. */
  stderrOffset?: number;
  /**
   * Reconnect after a dropped connection, resuming from the last received
   * offsets. Default `true`. Set to `false` to see exactly one connection.
   */
  reconnect?: boolean;
  /**
   * How many reconnects in a row may fail to deliver anything before the
   * stream gives up and throws. Default 5.
   */
  maxReconnectAttempts?: number;
  /** Cancels the stream. */
  signal?: AbortSignal;
  /**
   * Called when a following connection closes without an `exit` event. Return
   * the exit status if the command has exited (the stream then ends with it),
   * or `null` to reconnect.
   */
  resolveExit?: () => Promise<{ exitCode: number | null; signal: string | null } | null>;
}

/** Opens one SSE connection for the given offsets. @internal */
export type OpenLogStream = (query: {
  follow: boolean;
  stdoutOffset: number;
  stderrOffset: number;
  signal?: AbortSignal;
}) => Promise<Response>;

const RECONNECT_DELAYS_MS = [100, 250, 500, 1_000, 2_000];

/** Transient failures worth a reconnect: network errors, timeouts, rate limits and 5xx. */
const isRetryable = (error: unknown): boolean => {
  if (error instanceof ApiError) return error.status === 408 || error.status === 429 || error.status >= 500;
  if (error instanceof Error && error.name === 'AbortError') return false;
  return true;
};

const parseJson = (data: string): Record<string, unknown> | null => {
  try {
    const value: unknown = JSON.parse(data);
    return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

/**
 * Streams a command's output as {@link CommandLogEvent}s, transparently
 * reconnecting after a dropped connection and resuming at the next unseen
 * byte of each stream. Chunks the server replays after a reconnect are
 * trimmed, so every byte is delivered exactly once.
 *
 * The SSE `stdout`/`stderr` events carry `{ data: base64, offset }`, where
 * `offset` is the absolute position of the chunk's first byte; the final
 * `exit` event carries `{ exitCode, signal }`.
 *
 * @internal
 */
export async function* streamCommandLogs(
  open: OpenLogStream,
  options: CommandLogStreamOptions = {}
): AsyncGenerator<CommandLogEvent> {
  const follow = options.follow ?? true;
  const reconnect = options.reconnect ?? true;
  const maxAttempts = options.maxReconnectAttempts ?? 5;
  const next: Record<CommandStream, number> = {
    stdout: options.stdoutOffset ?? 0,
    stderr: options.stderrOffset ?? 0,
  };
  let failures = 0;

  for (;;) {
    let progressed = false;
    let serverError: ApiError | undefined;
    try {
      const response = await open({
        follow,
        stdoutOffset: next.stdout,
        stderrOffset: next.stderr,
        signal: options.signal,
      });
      for await (const event of parseSSEEvents(response)) {
        if (event.event === 'stdout' || event.event === 'stderr') {
          const payload = parseJson(event.data);
          if (!payload || typeof payload.data !== 'string') continue;
          const stream: CommandStream = event.event;
          let data = base64ToBytes(payload.data);
          let offset = typeof payload.offset === 'number' ? payload.offset : next[stream];
          progressed = true;
          // Drop bytes already delivered before a reconnect.
          if (offset < next[stream]) {
            const skip = next[stream] - offset;
            if (skip >= data.length) continue;
            data = data.subarray(skip);
            offset = next[stream];
          }
          next[stream] = offset + data.length;
          if (data.length > 0) yield { type: 'output', stream, data, offset };
        } else if (event.event === 'exit') {
          const payload = parseJson(event.data) ?? {};
          yield {
            type: 'exit',
            exitCode: typeof payload.exitCode === 'number' ? payload.exitCode : null,
            signal: typeof payload.signal === 'string' ? payload.signal : null,
          };
          return;
        } else if (event.event === 'error') {
          const payload = parseJson(event.data);
          const message = typeof payload?.error === 'string' ? payload.error : event.data;
          serverError = new ApiError(message, 502, typeof payload?.code === 'string' ? payload.code : undefined);
          throw serverError;
        }
      }
      // The connection closed without an `exit` event.
      if (!follow || !reconnect) return;
      const exit = progressed ? null : await options.resolveExit?.();
      if (exit) {
        yield { type: 'exit', exitCode: exit.exitCode, signal: exit.signal };
        return;
      }
    } catch (error) {
      if (error === serverError || options.signal?.aborted || !reconnect || !isRetryable(error)) throw error;
      if (!progressed && failures >= maxAttempts) throw error;
    }
    failures = progressed ? 0 : failures + 1;
    if (failures > maxAttempts) {
      throw new ApiError('The command log stream kept closing without output', 502, 'log_stream_closed');
    }
    await sleep(RECONNECT_DELAYS_MS[Math.min(failures, RECONNECT_DELAYS_MS.length - 1)], options.signal);
  }
}

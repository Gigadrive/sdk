import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../errors';
import { type OpenLogStream, streamCommandLogs } from './logs';
import { exit, out, sseResponse } from './test-utils';
import type { CommandLogEvent } from './types';

const decoder = new TextDecoder();

/** Collects the stream as `stream:text` strings plus the exit event. */
const collect = async (events: AsyncGenerator<CommandLogEvent>) => {
  const seen: string[] = [];
  for await (const event of events) {
    seen.push(
      event.type === 'output'
        ? `${event.stream}@${event.offset}:${decoder.decode(event.data)}`
        : event.type === 'exit'
          ? `exit:${event.exitCode}:${event.signal}`
          : event.type === 'end'
            ? `end:${event.reason}`
            : 'truncated'
    );
  }
  return seen;
};

/** A connection that delivers its chunks, then drops without an exit event. */
const dropped = (chunks: string[]) => sseResponse(chunks);

const opener = (...responses: Array<Response | Error>) => {
  const open = vi.fn<OpenLogStream>();
  for (const response of responses) {
    if (response instanceof Error) open.mockRejectedValueOnce(response);
    else open.mockResolvedValueOnce(response);
  }
  return open;
};

describe('streamCommandLogs', () => {
  it('yields output and ends at the exit event', async () => {
    const open = opener(sseResponse([out('stdout', 'a', 0), out('stderr', 'oops', 0), out('stdout', 'b', 1), exit(0)]));

    await expect(collect(streamCommandLogs(open))).resolves.toEqual([
      'stdout@0:a',
      'stderr@0:oops',
      'stdout@1:b',
      'exit:0:null',
    ]);
    expect(open).toHaveBeenCalledWith({ follow: true, stdoutOffset: 0, stderrOffset: 0, signal: undefined });
  });

  it('reports a signal on exit', async () => {
    const open = opener(sseResponse([exit(null, 'SIGKILL')]));

    await expect(collect(streamCommandLogs(open))).resolves.toEqual(['exit:null:SIGKILL']);
  });

  it('resumes after a dropped connection from the next unseen offsets', async () => {
    const open = opener(
      dropped([out('stdout', 'hello ', 0), out('stderr', 'warn', 0)]),
      sseResponse([out('stdout', 'world', 6), exit(0)])
    );

    await expect(collect(streamCommandLogs(open))).resolves.toEqual([
      'stdout@0:hello ',
      'stderr@0:warn',
      'stdout@6:world',
      'exit:0:null',
    ]);
    expect(open).toHaveBeenNthCalledWith(2, { follow: true, stdoutOffset: 6, stderrOffset: 4, signal: undefined });
  });

  it('trims bytes the server replays after a reconnect', async () => {
    const open = opener(
      dropped([out('stdout', 'abc', 0)]),
      // The server ignored our offset and replayed from 1: "bc" is a duplicate, "de" is new.
      sseResponse([out('stdout', 'bcde', 1), out('stdout', 'abc', 0), exit(0)])
    );

    await expect(collect(streamCommandLogs(open))).resolves.toEqual(['stdout@0:abc', 'stdout@3:de', 'exit:0:null']);
  });

  it('resumes after a network error mid-stream', async () => {
    let call = 0;
    let pulls = 0;
    const encoder = new TextEncoder();
    const open = vi.fn<OpenLogStream>(() => {
      call += 1;
      if (call === 1) {
        return Promise.resolve(
          new Response(
            new ReadableStream<Uint8Array>({
              // Deliver one event, then fail the next read, like a connection reset.
              pull(controller) {
                pulls += 1;
                if (pulls === 1) controller.enqueue(encoder.encode(out('stdout', 'one', 0)));
                else controller.error(new TypeError('socket hang up'));
              },
            })
          )
        );
      }
      return Promise.resolve(sseResponse([out('stdout', 'two', 3), exit(0)]));
    });

    await expect(collect(streamCommandLogs(open))).resolves.toEqual(['stdout@0:one', 'stdout@3:two', 'exit:0:null']);
  });

  it('retries transient API errors (5xx, 429) but not client errors', async () => {
    const transient = opener(new ApiError('Bad gateway', 502), new ApiError('Slow down', 429), sseResponse([exit(0)]));
    await expect(collect(streamCommandLogs(transient))).resolves.toEqual(['exit:0:null']);
    expect(transient).toHaveBeenCalledTimes(3);

    const forbidden = new ApiError('Forbidden', 403);
    const fatal = opener(forbidden);
    await expect(collect(streamCommandLogs(fatal))).rejects.toBe(forbidden);
    expect(fatal).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxReconnectAttempts connections without progress', async () => {
    const error = new ApiError('Unavailable', 503);
    const open = vi.fn<OpenLogStream>().mockRejectedValue(error);

    await expect(collect(streamCommandLogs(open, { maxReconnectAttempts: 2 }))).rejects.toBe(error);
    expect(open).toHaveBeenCalledTimes(3);
  });

  it('gives up when connections keep closing empty and the command is still running', async () => {
    const open = vi.fn<OpenLogStream>().mockImplementation(() => Promise.resolve(sseResponse([])));
    const resolveExit = vi.fn().mockResolvedValue(null);

    await expect(collect(streamCommandLogs(open, { maxReconnectAttempts: 1, resolveExit }))).rejects.toMatchObject({
      code: 'log_stream_closed',
    });
    expect(resolveExit).toHaveBeenCalled();
  });

  it('ends with the exit status from resolveExit when the stream closes after the command exited', async () => {
    const open = opener(dropped([out('stdout', 'done', 0)]), sseResponse([]));

    await expect(
      collect(streamCommandLogs(open, { resolveExit: () => Promise.resolve({ exitCode: 1, signal: null }) }))
    ).resolves.toEqual(['stdout@0:done', 'exit:1:null']);
  });

  it('does not reconnect when follow is false', async () => {
    const open = opener(sseResponse([out('stdout', 'buffered', 0)]));

    await expect(collect(streamCommandLogs(open, { follow: false }))).resolves.toEqual(['stdout@0:buffered']);
    expect(open).toHaveBeenCalledWith({ follow: false, stdoutOffset: 0, stderrOffset: 0, signal: undefined });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('does not reconnect when reconnect is false', async () => {
    const error = new ApiError('Bad gateway', 502);
    const open = opener(dropped([out('stdout', 'x', 0)]), error);

    await expect(collect(streamCommandLogs(open, { reconnect: false }))).resolves.toEqual(['stdout@0:x']);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('starts from the given offsets', async () => {
    const open = opener(sseResponse([exit(0)]));

    await collect(streamCommandLogs(open, { stdoutOffset: 100, stderrOffset: 7 }));

    expect(open).toHaveBeenCalledWith({ follow: true, stdoutOffset: 100, stderrOffset: 7, signal: undefined });
  });

  it('stops retrying once the signal aborted', async () => {
    const controller = new AbortController();
    const error = new TypeError('fetch failed');
    const open = vi.fn<OpenLogStream>(() => {
      controller.abort();
      return Promise.reject(error);
    });

    await expect(collect(streamCommandLogs(open, { signal: controller.signal }))).rejects.toBe(error);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('throws an error event from the server', async () => {
    const open = opener(
      sseResponse(['event: error\ndata: {"error":"guest unreachable","code":"sandbox_unreachable"}\n\n'])
    );

    await expect(collect(streamCommandLogs(open))).rejects.toMatchObject({
      message: 'guest unreachable',
      code: 'sandbox_unreachable',
    });
  });

  it('reports truncation from the server', async () => {
    const open = opener(sseResponse(['event: truncated\ndata: {}\n\n', out('stdout', 'tail', 9_000), exit(0)]));

    await expect(collect(streamCommandLogs(open))).resolves.toEqual(['truncated', 'stdout@9000:tail', 'exit:0:null']);
  });

  it('ends at an end event (follow=false snapshot of a running command) without reconnecting', async () => {
    const open = opener(sseResponse([out('stdout', 'so far', 0), 'event: end\ndata: {"reason":"snapshot"}\n\n']));
    const resolveExit = vi.fn();

    await expect(collect(streamCommandLogs(open, { follow: false, resolveExit }))).resolves.toEqual([
      'stdout@0:so far',
      'end:snapshot',
    ]);
    expect(open).toHaveBeenCalledTimes(1);
    expect(resolveExit).not.toHaveBeenCalled();
  });

  it('reconnects after a retryable error event', async () => {
    const open = opener(
      sseResponse([out('stdout', 'a', 0), 'event: error\ndata: {"message":"guest hiccup","retryable":true}\n\n']),
      sseResponse([out('stdout', 'b', 1), exit(0)])
    );

    await expect(collect(streamCommandLogs(open))).resolves.toEqual(['stdout@0:a', 'stdout@1:b', 'exit:0:null']);
    expect(open).toHaveBeenNthCalledWith(2, { follow: true, stdoutOffset: 1, stderrOffset: 0, signal: undefined });
  });

  it('ignores unknown events and malformed payloads', async () => {
    const open = opener(
      sseResponse([': keep-alive\n\n', 'event: progress\ndata: {}\n\n', 'event: stdout\ndata: nope\n\n', exit(0)])
    );

    await expect(collect(streamCommandLogs(open))).resolves.toEqual(['exit:0:null']);
  });
});

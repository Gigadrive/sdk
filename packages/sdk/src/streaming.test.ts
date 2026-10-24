import { describe, expect, it } from 'vitest';
import { parseSSEEvents, parseSSEStream } from './streaming';

const sseResponse = (chunks: string[]): Response => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream);
};

describe('parseSSEStream', () => {
  it('parses data events and stops at [DONE]', async () => {
    const response = sseResponse(['data: {"i":1}\n\n', 'data: {"i":2}\n\n', 'data: [DONE]\n\n']);
    const received: unknown[] = [];
    for await (const chunk of parseSSEStream(response)) received.push(chunk);
    expect(received).toEqual([{ i: 1 }, { i: 2 }]);
  });

  it('handles events split across stream reads', async () => {
    const response = sseResponse(['data: {"par', 't":true}\n\n']);
    const received: unknown[] = [];
    for await (const chunk of parseSSEStream(response)) received.push(chunk);
    expect(received).toEqual([{ part: true }]);
  });

  it('handles a CRLF event separator split across two reads', async () => {
    const response = sseResponse(['data: {"a":1}\r\n', '\r\ndata: {"b":2}\r\n\r\n']);
    const received: unknown[] = [];
    for await (const chunk of parseSSEStream(response)) received.push(chunk);
    expect(received).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('ignores empty/whitespace-only data events without throwing', async () => {
    const response = sseResponse(['data: {"i":1}\n\n', 'data: \n\n', ': keep-alive comment\n\n', 'data:\n\n']);
    const received: unknown[] = [];
    for await (const chunk of parseSSEStream(response)) received.push(chunk);
    expect(received).toEqual([{ i: 1 }]);
  });

  it('throws a descriptive error on malformed JSON', async () => {
    const response = sseResponse(['data: {not json}\n\n']);
    await expect(async () => {
      for await (const _ of parseSSEStream(response)) void _;
    }).rejects.toThrow(/Failed to parse streamed SSE data/);
  });
});

describe('parseSSEEvents', () => {
  const collect = async (response: Response) => {
    const events: unknown[] = [];
    for await (const event of parseSSEEvents(response)) events.push(event);
    return events;
  };

  it('keeps event names, ids and retry hints', async () => {
    const response = sseResponse([
      'event: stdout\nid: 7\ndata: {"a":1}\n\n',
      'data: plain\n\n',
      'retry: 1500\nevent: exit\ndata: {"exitCode":0}\n\n',
    ]);

    await expect(collect(response)).resolves.toEqual([
      { event: 'stdout', data: '{"a":1}', id: '7', retry: undefined },
      { event: 'message', data: 'plain', id: undefined, retry: undefined },
      { event: 'exit', data: '{"exitCode":0}', id: undefined, retry: 1500 },
    ]);
  });

  it('joins multi-line data and skips comments and data-less blocks', async () => {
    const response = sseResponse([': ping\n\n', 'event: lonely\n\n', 'data: one\ndata: two\n\n']);

    await expect(collect(response)).resolves.toEqual([
      { event: 'message', data: 'one\ntwo', id: undefined, retry: undefined },
    ]);
  });

  it('handles CRLF, split reads and a final event without a trailing blank line', async () => {
    const response = sseResponse(['event: std', 'err\r\ndata: x\r\n', '\r\nevent: exit\r\ndata: y']);

    await expect(collect(response)).resolves.toEqual([
      { event: 'stderr', data: 'x', id: undefined, retry: undefined },
      { event: 'exit', data: 'y', id: undefined, retry: undefined },
    ]);
  });

  it('cancels the body when the consumer stops early', async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: 1\n\ndata: 2\n\n'));
      },
      cancel() {
        cancelled = true;
      },
    });
    for await (const _ of parseSSEEvents(new Response(stream))) break;
    expect(cancelled).toBe(true);
  });

  it('still lets parseSSEStream read named events as JSON', async () => {
    const response = sseResponse(['event: stdout\ndata: {"i":1}\n\n']);
    const received: unknown[] = [];
    for await (const chunk of parseSSEStream(response)) received.push(chunk);
    expect(received).toEqual([{ i: 1 }]);
  });
});

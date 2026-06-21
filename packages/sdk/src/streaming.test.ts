import { describe, expect, it } from 'vitest';
import { parseSSEStream } from './streaming';

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

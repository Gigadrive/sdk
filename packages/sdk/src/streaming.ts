/**
 * Server-Sent Events (SSE) parsing for streamed API responses (e.g. streamed
 * chat completions). Works in browsers and Node.js 18+ where `Response.body` is
 * a web `ReadableStream`.
 *
 * @internal
 */

/** Extract and concatenate the `data:` payload(s) from a single SSE event block. */
const extractData = (rawEvent: string): string | null => {
  const dataLines = rawEvent
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).replace(/^ /, ''));
  if (dataLines.length === 0) return null;
  const joined = dataLines.join('\n');
  // Treat whitespace-only events (e.g. keep-alive comments or a truncated final
  // "data:" line) as "no data" so we never call JSON.parse on an empty string.
  return joined.trim().length === 0 ? null : joined;
};

const parseEvent = <T>(data: string): T => {
  try {
    return JSON.parse(data) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse streamed SSE data as JSON: ${message}`);
  }
};

/**
 * Parse an SSE stream, yielding each event's `data` payload parsed as JSON.
 * The `[DONE]` sentinel and empty keep-alive events are skipped; iteration ends
 * when the underlying stream closes.
 *
 * @typeParam T - The shape of each streamed JSON chunk.
 * @param response - A streaming `fetch` response.
 */
export async function* parseSSEStream<T = unknown>(response: Response): AsyncGenerator<T> {
  const body = response.body as ReadableStream<Uint8Array> | null;
  if (!body) {
    throw new Error('The response has no readable body to stream.');
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const drain = function* (flush: boolean): Generator<T> {
    // SSE events are separated by a blank line; CRLF is normalised on read.
    let separator = buffer.indexOf('\n\n');
    while (separator !== -1) {
      const rawEvent = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      const data = extractData(rawEvent);
      if (data !== null && data !== '[DONE]') {
        yield parseEvent<T>(data);
      }
      separator = buffer.indexOf('\n\n');
    }
    if (flush) {
      const data = extractData(buffer);
      buffer = '';
      if (data !== null && data !== '[DONE]') {
        yield parseEvent<T>(data);
      }
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      // Normalise CRLF on the whole buffer so a separator split across two reads
      // (a trailing "\r" then a leading "\n") is still collapsed correctly.
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');
      yield* drain(false);
    }
    yield* drain(true);
  } finally {
    // Cancel (not just release the lock) so breaking out of the consumer's
    // `for await` early stops the underlying HTTP body instead of leaking it.
    await reader.cancel().catch(() => undefined);
  }
}

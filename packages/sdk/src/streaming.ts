/**
 * Server-Sent Events (SSE) parsing for streamed API responses (e.g. streamed
 * chat completions and command logs). Works in browsers, Node.js 18+, Bun,
 * Deno and edge runtimes, wherever `Response.body` is a web `ReadableStream`.
 *
 * @internal
 */

/** One dispatched Server-Sent Event. */
export interface ServerSentEvent {
  /** The `event:` field, or `message` when the server sent none. */
  event: string;
  /** The `data:` lines of the event, joined with `\n`. */
  data: string;
  /** The `id:` field of this event, when the server sent one. */
  id: string | undefined;
  /** The `retry:` reconnection delay in milliseconds, when the server sent one. */
  retry: number | undefined;
}

/**
 * Parse one SSE event block. Returns `null` for blocks without `data:` lines
 * (comments and keep-alives), which the SSE specification does not dispatch.
 */
const parseBlock = (rawEvent: string): ServerSentEvent | null => {
  let event = 'message';
  let id: string | undefined;
  let retry: number | undefined;
  const data: string[] = [];
  for (const line of rawEvent.split('\n')) {
    if (line === '' || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
    if (field === 'data') data.push(value);
    else if (field === 'event') event = value || 'message';
    else if (field === 'id' && !value.includes('\0')) id = value;
    else if (field === 'retry' && /^\d+$/.test(value)) retry = Number(value);
  }
  if (data.length === 0) return null;
  return { event, data: data.join('\n'), id, retry };
};

const parseEvent = <T>(data: string): T => {
  try {
    return JSON.parse(data) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse streamed SSE data as JSON: ${message}`);
  }
};

/** Split a streamed body into raw SSE event blocks (separated by a blank line). */
async function* readEventBlocks(response: Response): AsyncGenerator<string> {
  const body = response.body as ReadableStream<Uint8Array> | null;
  if (!body) {
    throw new Error('The response has no readable body to stream.');
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      // Normalise CRLF on the whole buffer so a separator split across two reads
      // (a trailing "\r" then a leading "\n") is still collapsed correctly.
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');
      let separator = buffer.indexOf('\n\n');
      while (separator !== -1) {
        yield buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        separator = buffer.indexOf('\n\n');
      }
    }
    buffer += decoder.decode();
    if (buffer.length > 0) yield buffer;
  } finally {
    // Cancel (not just release the lock) so breaking out of the consumer's
    // `for await` early stops the underlying HTTP body instead of leaking it.
    await reader.cancel().catch(() => undefined);
  }
}

/**
 * Parse an SSE stream into events, keeping the event name, id and retry
 * fields. Comment and keep-alive blocks are skipped; iteration ends when the
 * underlying stream closes. Breaking out of the loop cancels the response body.
 *
 * @param response - A streaming `fetch` response.
 *
 * @example
 * ```ts
 * for await (const event of parseSSEEvents(response)) {
 *   if (event.event === 'exit') break;
 *   console.log(event.event, event.data);
 * }
 * ```
 */
export async function* parseSSEEvents(response: Response): AsyncGenerator<ServerSentEvent> {
  for await (const block of readEventBlocks(response)) {
    const event = parseBlock(block);
    if (event) yield event;
  }
}

/**
 * Parse an SSE stream, yielding each event's `data` payload parsed as JSON.
 * Event names are ignored (use {@link parseSSEEvents} to read them). The
 * `[DONE]` sentinel and empty keep-alive events are skipped; iteration ends
 * when the underlying stream closes.
 *
 * @typeParam T - The shape of each streamed JSON chunk.
 * @param response - A streaming `fetch` response.
 */
export async function* parseSSEStream<T = unknown>(response: Response): AsyncGenerator<T> {
  for await (const event of parseSSEEvents(response)) {
    // Treat whitespace-only events (e.g. a truncated final "data:" line) as
    // "no data" so we never call JSON.parse on an empty string.
    if (event.data.trim().length === 0 || event.data === '[DONE]') continue;
    yield parseEvent<T>(event.data);
  }
}

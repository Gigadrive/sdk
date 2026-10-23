import { type Mock, vi } from 'vitest';
import { GigadriveClient } from '../client';
import type { CommandInfo, MicroVmInfo } from './types';

/**
 * Test helpers for the microVM tests: a {@link GigadriveClient} on a mocked
 * `fetch`, response builders and fixtures.
 *
 * @internal
 */

export const BASE_URL = 'https://api.test';

export const json = (body: unknown, status = 200): Response =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const apiError = (status: number, error: string, code?: string): Response =>
  json(code ? { error, code } : { error }, status);

const encoder = new TextEncoder();

/** Base64 of a UTF-8 string. */
export const b64 = (text: string): string => {
  let binary = '';
  for (const byte of encoder.encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
};

/** A `text/event-stream` response from raw chunks. */
export const sseResponse = (chunks: string[]): Response =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
  );

/** An SSE `stdout`/`stderr` event. */
export const out = (stream: 'stdout' | 'stderr', text: string, offset: number): string =>
  `event: ${stream}\ndata: ${JSON.stringify({ data: b64(text), offset })}\n\n`;

/** The final SSE `exit` event. */
export const exit = (exitCode: number | null, signal: string | null = null): string =>
  `event: exit\ndata: ${JSON.stringify({ exitCode, signal })}\n\n`;

/** A client whose `fetch` is a mock; inspect calls with {@link request}. */
export const setup = (
  config: { applicationId?: string } = {}
): { fetch: Mock<typeof globalThis.fetch>; client: GigadriveClient } => {
  const fetch = vi.fn<typeof globalThis.fetch>();
  const client = new GigadriveClient({ bearerToken: 'test-token', baseUrl: BASE_URL, fetch, ...config });
  return { fetch, client };
};

/** One request the mocked fetch received. */
export interface RecordedRequest {
  url: URL;
  path: string;
  query: Record<string, string>;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  /** The body parsed as JSON, or `undefined` when it is not a JSON string. */
  json: unknown;
  init: RequestInit | undefined;
}

const parseJson = (body: unknown): unknown => {
  if (typeof body !== 'string') return undefined;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
};

/** The n-th request the mocked fetch received. */
export const request = (fetch: Mock<typeof globalThis.fetch>, index = 0): RecordedRequest => {
  const call = fetch.mock.calls[index];
  if (!call) throw new Error(`fetch was called ${fetch.mock.calls.length} times, wanted call ${index}`);
  const [input, init] = call;
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const body = init?.body;
  return {
    url,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    method: init?.method ?? 'GET',
    headers: (init?.headers ?? {}) as Record<string, string>,
    body,
    json: parseJson(body),
    init,
  };
};

export const vmInfo = (overrides: Partial<MicroVmInfo> = {}): MicroVmInfo => ({
  id: 'vm-1',
  slug: 'k3j9x2m1q8zt',
  applicationId: 'app-1',
  organizationId: 'org-1',
  status: 'running',
  image: { id: 'img-1', name: 'node22' },
  vcpus: 1,
  memoryMb: 2048,
  diskMb: 10240,
  region: 'fr-par',
  ports: [{ port: 3000, url: 'https://3000-k3j9x2m1q8zt.vm.gigadrive.app' }],
  network: { egress: 'allow' },
  metadata: {},
  timeoutMs: 300_000,
  expiresAt: '2026-10-23T12:05:00.000Z',
  createdAt: '2026-10-23T12:00:00.000Z',
  startedAt: '2026-10-23T12:00:01.000Z',
  stoppedAt: null,
  stopReason: null,
  ...overrides,
});

export const commandInfo = (overrides: Partial<CommandInfo> = {}): CommandInfo => ({
  id: 'cmd_0123456789abcdef',
  cmd: 'node',
  args: ['server.js'],
  cwd: null,
  status: 'running',
  exitCode: null,
  signal: null,
  pid: 42,
  pty: false,
  startedAt: '2026-10-23T12:00:00.000Z',
  finishedAt: null,
  ...overrides,
});

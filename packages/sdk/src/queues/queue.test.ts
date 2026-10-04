import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../errors';
import type { HttpClient } from '../http-client';
import { QueuesResource, type QueueMessageRecord } from '../resources/queues';
import { NonRetryableError, RetryLaterError } from './errors';
import { signQueueDelivery } from './signature';

const APP = '0197b2f1-2f4a-7a0b-8a2d-222222222222';
const SECRET = 'test-signing-secret';

const http = { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() };
const resource = new QueuesResource(http as unknown as HttpClient, APP);

const record = (overrides: Partial<QueueMessageRecord> = {}): QueueMessageRecord => ({
  id: 'msg-1',
  state: 'inflight',
  body: '{"to":"jane@example.com"}',
  encoding: 'utf8',
  bodyTruncated: false,
  contentType: 'application/json',
  headers: {},
  attempts: 1,
  sizeBytes: 25,
  groupKey: null,
  deduplicationKey: null,
  deploymentId: null,
  source: null,
  lastError: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  deliverAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-01-05T00:00:00.000Z',
  leaseExpiresAt: '2026-01-01T00:01:00.000Z',
  lastDeliveredAt: '2026-01-01T00:00:00.000Z',
  deadAt: null,
  receipt: 'rcpt-1',
  ...overrides,
});

const delivery = async (body: string, overrides: { secret?: string; headers?: Record<string, string> } = {}) => {
  const fields = { queue: 'emails', messageId: 'msg-1', attempt: 2, body };
  return new Request('https://app.example/api/queues/emails', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      'x-gigadrive-queue-name': fields.queue,
      'x-gigadrive-queue-message-id': fields.messageId,
      'x-gigadrive-queue-attempt': String(fields.attempt),
      'x-gigadrive-queue-created-at': '1767225600000',
      'x-gigadrive-queue-signature': await signQueueDelivery({ ...fields, secret: overrides.secret ?? SECRET }),
      'x-tenant': 'acme',
      ...overrides.headers,
    },
  });
};

beforeEach(() => {
  for (const fn of Object.values(http)) fn.mockReset();
});

describe('Queue.send', () => {
  const emails = resource.queue<{ to: string }>('emails', { environment: 'production' });

  it('sends JSON with delay, ordering, deduplication and pinning', async () => {
    http.post.mockResolvedValue({ messageId: 'msg-1', deduplicated: false, deliverAt: '2026-01-01T00:10:00.000Z' });

    const sent = await emails.send(
      { to: 'jane@example.com' },
      { delay: '10m', groupKey: 'user-1', deduplicationKey: 'welcome:1', headers: { 'x-tenant': 'acme' } }
    );

    expect(sent).toEqual({ messageId: 'msg-1', deduplicated: false, deliverAt: new Date('2026-01-01T00:10:00.000Z') });
    expect(http.post).toHaveBeenCalledWith(`/applications/${APP}/queues/emails/messages`, {
      environment: 'production',
      autoCreate: undefined,
      body: '{"to":"jane@example.com"}',
      encoding: 'utf8',
      contentType: 'application/json',
      headers: { 'x-tenant': 'acme' },
      delaySeconds: 600,
      groupKey: 'user-1',
      deduplicationKey: 'welcome:1',
    });
  });

  it('lets an absolute time win over a delay and sends binary as base64', async () => {
    http.post.mockResolvedValue({ messageId: 'msg-2', deduplicated: true, deliverAt: '2027-01-01T09:00:00.000Z' });
    const files = resource.queue<Uint8Array>('files');

    await files.send(new Uint8Array([1, 2, 3]), { at: new Date('2027-01-01T09:00:00Z'), delay: 5 });

    expect(http.post.mock.calls[0]![1]).toMatchObject({
      body: 'AQID',
      encoding: 'base64',
      contentType: 'application/octet-stream',
      deliverAt: '2027-01-01T09:00:00.000Z',
    });
    expect(http.post.mock.calls[0]![1]).not.toHaveProperty('delaySeconds');
  });

  it('throws an ApiError when the platform refuses the message', async () => {
    http.post.mockResolvedValue({
      messageId: null,
      error: 'Storage limit reached',
      code: 'backlog_full',
      retryable: true,
    });

    await expect(emails.send({ to: 'jane@example.com' })).rejects.toMatchObject({
      name: 'ApiError',
      code: 'backlog_full',
    });
  });

  it('rejects an invalid scheduled time before calling the API', async () => {
    await expect(emails.send({ to: 'jane@example.com' }, { at: 'not a date' })).rejects.toThrow('Invalid `at` time');
    expect(http.post).not.toHaveBeenCalled();
  });

  it('batches in chunks of 100 and keeps per-message outcomes in order', async () => {
    http.post.mockImplementation((_path: string, body: { messages: unknown[] }) =>
      Promise.resolve({
        results: body.messages.map((_message, index) =>
          index === 0 && body.messages.length === 5
            ? { messageId: null, error: 'Storage limit reached', code: 'backlog_full', retryable: true }
            : { messageId: `m${String(index)}`, deduplicated: false, deliverAt: '2026-01-01T00:00:00.000Z' }
        ),
      })
    );

    const results = await emails.sendBatch(
      Array.from({ length: 105 }, (_, index) => ({ payload: { to: `${String(index)}@example.com` } }))
    );

    expect(http.post).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(105);
    expect(results[100]).toMatchObject({ messageId: null });
    expect(results[100]!.error).toBeInstanceOf(ApiError);
    expect(results[101]).toMatchObject({ messageId: 'm1' });
  });
});

describe('Queue.receive and consume', () => {
  const jobs = resource.queue<{ to: string }>('jobs');

  it('decodes received messages and settles them with their receipt', async () => {
    http.post.mockResolvedValueOnce({ messages: [record()] }).mockResolvedValue({});

    const [message] = await jobs.receive({ maxMessages: 5, wait: '30s', visibilityTimeout: '2m' });

    expect(http.post).toHaveBeenCalledWith(
      `/applications/${APP}/queues/jobs/messages/receive`,
      { environment: undefined, maxMessages: 5, waitSeconds: 20, visibilityTimeoutSeconds: 120 },
      { signal: undefined }
    );
    expect(message!.payload).toEqual({ to: 'jane@example.com' });
    await message!.ack();
    await message!.defer('1m');
    await message!.deadLetter('bad');
    await message!.extendLease(300);
    expect(http.post.mock.calls.slice(1).map(([path, body]: [string, unknown]) => [path, body])).toEqual([
      [`/applications/${APP}/queues/jobs/messages/msg-1/ack`, { environment: undefined, receipt: 'rcpt-1' }],
      [
        `/applications/${APP}/queues/jobs/messages/msg-1/nack`,
        { environment: undefined, receipt: 'rcpt-1', delaySeconds: 60, countAttempt: false },
      ],
      [
        `/applications/${APP}/queues/jobs/messages/msg-1/nack`,
        { environment: undefined, receipt: 'rcpt-1', deadLetter: true, error: 'bad' },
      ],
      [
        `/applications/${APP}/queues/jobs/messages/msg-1/extend`,
        { environment: undefined, receipt: 'rcpt-1', visibilityTimeoutSeconds: 300 },
      ],
    ]);
  });

  it('acks successes, defers RetryLater, dead-letters NonRetryable and retries other errors', async () => {
    const batches = [
      [
        record({ id: 'ok', receipt: 'r-ok' }),
        record({ id: 'later', receipt: 'r-later' }),
        record({ id: 'never', receipt: 'r-never' }),
        record({ id: 'boom', receipt: 'r-boom' }),
        record({ id: 'garbled', receipt: 'r-garbled', body: '{not json' }),
      ],
      [],
    ];
    http.post.mockImplementation((path: string, body: { messages?: { messageId: string }[] }) => {
      if (path.endsWith('/receive')) return Promise.resolve({ messages: batches.shift() ?? [] });
      if (path.endsWith('/messages/ack')) {
        return Promise.resolve({
          results: (body.messages ?? []).map(({ messageId }) => ({ messageId, acknowledged: true })),
        });
      }
      return Promise.resolve({});
    });

    await jobs.consume(
      (_payload, meta) => {
        if (meta.messageId === 'later') throw new RetryLaterError('5m');
        if (meta.messageId === 'never') throw new NonRetryableError('invalid recipient');
        if (meta.messageId === 'boom') throw new Error('SMTP timeout');
      },
      { stopWhenEmpty: true }
    );

    const settled = http.post.mock.calls
      .filter(([path]: [string]) => !path.endsWith('/receive'))
      .map(([path, body]: [string, Record<string, unknown>]) => [path.split('/messages/')[1], body]);
    expect(settled).toEqual(
      expect.arrayContaining([
        ['ack', { environment: undefined, messages: [{ messageId: 'ok', receipt: 'r-ok' }] }],
        ['later/nack', { environment: undefined, receipt: 'r-later', delaySeconds: 300, countAttempt: false }],
        ['never/nack', { environment: undefined, receipt: 'r-never', deadLetter: true, error: 'invalid recipient' }],
        ['boom/nack', { environment: undefined, receipt: 'r-boom', error: 'SMTP timeout' }],
        [
          'garbled/nack',
          expect.objectContaining({
            receipt: 'r-garbled',
            deadLetter: true,
            error: expect.stringMatching(/^Undecodable payload/),
          }),
        ],
      ])
    );
    expect(settled).toHaveLength(5);
  });

  it('stops polling when the signal aborts', async () => {
    const controller = new AbortController();
    http.post.mockImplementation(() => {
      controller.abort();
      return Promise.reject(new Error('aborted'));
    });

    await expect(jobs.consume(() => undefined, { signal: controller.signal })).resolves.toBeUndefined();
  });

  it('reports a failed acknowledgement instead of retrying work that succeeded', async () => {
    let receives = 0;
    http.post.mockImplementation((path: string) => {
      if (path.endsWith('/receive')) return Promise.resolve({ messages: receives++ === 0 ? [record()] : [] });
      if (path.endsWith('/ack')) return Promise.reject(new Error('fetch failed'));
      return Promise.resolve({});
    });
    const onError = vi.fn();

    await jobs.consume(() => undefined, { stopWhenEmpty: true, onError });

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'fetch failed' }));
    expect(http.post.mock.calls.some(([path]: [string]) => path.endsWith('/nack'))).toBe(false);
  });

  it('acknowledges messages that finish together in one request and reports refused ones', async () => {
    let receives = 0;
    http.post.mockImplementation((path: string, body: { messages?: { messageId: string }[] }) => {
      if (path.endsWith('/receive')) {
        return Promise.resolve({
          messages: receives++ === 0 ? Array.from({ length: 12 }, (_, i) => record({ id: `m${String(i)}` })) : [],
        });
      }
      return Promise.resolve({
        results: (body.messages ?? []).map(({ messageId }) =>
          messageId === 'm3'
            ? { messageId, acknowledged: false, code: 'receipt_mismatch' }
            : { messageId, acknowledged: true }
        ),
      });
    });
    const onError = vi.fn();

    await jobs.consume(() => undefined, { maxMessages: 12, stopWhenEmpty: true, onError });

    const acks = http.post.mock.calls.filter(([path]: [string]) => path.endsWith('/messages/ack'));
    expect(acks).toHaveLength(1);
    expect((acks[0] as [string, { messages: unknown[] }])[1].messages).toHaveLength(12);
    expect(onError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ message: 'Acknowledging message failed: receipt_mismatch', status: 409 })
    );
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(ApiError);
    expect(onError.mock.calls[0]?.[0]).toMatchObject({ code: 'receipt_mismatch' });
  });

  it('retries a batch acknowledgement that failed in transit, counting an already-landed one as done', async () => {
    let receives = 0;
    let acks = 0;
    http.post.mockImplementation((path: string, body: { messages?: { messageId: string }[] }) => {
      if (path.endsWith('/receive')) {
        return Promise.resolve({ messages: receives++ === 0 ? [record({ id: 'a' }), record({ id: 'b' })] : [] });
      }
      acks += 1;
      // The first request landed for `a` but its answer was lost.
      if (acks === 1) return Promise.reject(new ApiError('Bad gateway', 502));
      return Promise.resolve({
        results: (body.messages ?? []).map(({ messageId }) =>
          messageId === 'a'
            ? { messageId, acknowledged: false, code: 'message_not_found' }
            : { messageId, acknowledged: true }
        ),
      });
    });
    const onError = vi.fn();

    await jobs.consume(() => undefined, { maxMessages: 2, stopWhenEmpty: true, onError });

    expect(acks).toBe(2);
    expect(onError).not.toHaveBeenCalled();
  });

  it('does not retry an acknowledgement the API refused, and falls back to single acks without the batch route', async () => {
    let receives = 0;
    http.post.mockImplementation((path: string) => {
      if (path.endsWith('/receive'))
        return Promise.resolve({ messages: receives++ === 0 ? [record({ id: 'a' })] : [] });
      if (path.endsWith('/messages/ack')) return Promise.reject(new ApiError('Not found', 404));
      return Promise.resolve({ acknowledged: true });
    });
    const onError = vi.fn();

    await jobs.consume(() => undefined, { stopWhenEmpty: true, onError });

    const paths = http.post.mock.calls.map(([path]: [string]) => path.split('/messages/')[1]);
    expect(paths).toEqual(['receive', 'ack', 'a/ack', 'receive']);
    expect(onError).not.toHaveBeenCalled();

    http.post.mockReset();
    receives = 0;
    http.post.mockImplementation((path: string) => {
      if (path.endsWith('/receive'))
        return Promise.resolve({ messages: receives++ === 0 ? [record({ id: 'b' })] : [] });
      return Promise.reject(new ApiError('Forbidden', 403, 'forbidden'));
    });
    await jobs.consume(() => undefined, { stopWhenEmpty: true, onError });
    expect(http.post.mock.calls.filter(([path]: [string]) => path.endsWith('/messages/ack'))).toHaveLength(1);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it('pauses between empty receives that return early, such as from a paused queue', async () => {
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      http.post.mockResolvedValue({ messages: [] });
      const consuming = jobs.consume(() => undefined, { wait: 0, signal: controller.signal });
      await vi.advanceTimersByTimeAsync(0);
      expect(http.post).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(999);
      expect(http.post).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(http.post).toHaveBeenCalledTimes(2);
      controller.abort();
      await expect(consuming).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Queue.handler', () => {
  const emails = resource.queue<{ to: string }>('emails', {
    signingSecret: SECRET,
    validate: (value) => {
      const to = (value as { to?: unknown }).to;
      if (typeof to !== 'string') throw new Error('to is required');
      return { to };
    },
  });

  afterEach(() => vi.restoreAllMocks());

  it('acknowledges a verified delivery and passes its metadata', async () => {
    const handler = vi.fn();

    const response = await emails.handler(handler)(await delivery('{"to":"jane@example.com"}'));

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      { to: 'jane@example.com' },
      expect.objectContaining({
        messageId: 'msg-1',
        queue: 'emails',
        attempt: 2,
        createdAt: new Date(1_767_225_600_000),
        headers: expect.objectContaining({ 'x-tenant': 'acme' }),
      })
    );
    expect(handler.mock.calls[0]![1].headers).not.toHaveProperty('x-gigadrive-queue-signature');
  });

  it('refuses a signed delivery of another queue', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handler = vi.fn();
    const jobsHandler = resource.queue('jobs', { signingSecret: SECRET }).handler(handler);
    // A genuine delivery for "emails", replayed at the "jobs" route.
    expect((await jobsHandler(await delivery('{"to":"jane@example.com"}'))).status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects unsigned, forged and non-queue requests without calling the handler', async () => {
    const handler = vi.fn();
    const serve = emails.handler(handler);

    expect((await serve(await delivery('{"to":"jane@example.com"}', { secret: 'forged' }))).status).toBe(401);
    expect(
      (await serve(await delivery('{"to":"jane@example.com"}', { headers: { 'x-gigadrive-queue-signature': '' } })))
        .status
    ).toBe(401);
    expect(
      (await serve(new Request('https://app.example/api/queues/emails', { method: 'POST', body: '{}' }))).status
    ).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it('refuses deliveries when no signing secret is configured, unless unsigned is allowed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('GIGADRIVE_QUEUE_SIGNING_SECRET', '');
    const request = await delivery('{"to":"jane@example.com"}');

    expect((await resource.queue('emails').handler(vi.fn())(request.clone())).status).toBe(500);
    expect((await resource.queue('emails', { allowUnsigned: true }).handler(vi.fn())(request)).status).toBe(200);
    vi.unstubAllEnvs();
  });

  it('reads the signing secret from the environment by default', async () => {
    vi.stubEnv('GIGADRIVE_QUEUE_SIGNING_SECRET', SECRET);
    const response = await resource.queue('emails').handler(vi.fn())(await delivery('{"to":"jane@example.com"}'));
    expect(response.status).toBe(200);
    vi.unstubAllEnvs();
  });

  it('maps RetryLater, NonRetryable, validation and other failures onto delivery outcomes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const deferred = await emails.handler(() => {
      throw new RetryLaterError('2m');
    })(await delivery('{"to":"jane@example.com"}'));
    expect(deferred.status).toBe(200);
    expect(deferred.headers.get('x-gigadrive-queue-retry-after')).toBe('120');

    const dead = await emails.handler(() => {
      throw new NonRetryableError('Unknown template\nid');
    })(await delivery('{"to":"jane@example.com"}'));
    expect(dead.status).toBe(422);
    expect(dead.headers.get('x-gigadrive-queue-action')).toBe('dead-letter');
    expect(dead.headers.get('x-gigadrive-queue-error')).toBe('Unknown template id');

    const invalid = await emails.handler(vi.fn())(await delivery('{"from":"x"}'));
    expect(invalid.status).toBe(422);
    expect(invalid.headers.get('x-gigadrive-queue-action')).toBe('dead-letter');

    const failed = await emails.handler(() => {
      throw new Error('SMTP timeout');
    })(await delivery('{"to":"jane@example.com"}'));
    expect(failed.status).toBe(500);
    expect(failed.headers.get('x-gigadrive-queue-action')).toBeNull();
    // The dispatcher records the start of the body; the error header only counts with a dead-letter action.
    expect(failed.headers.get('x-gigadrive-queue-error')).toBeNull();
    await expect(failed.json()).resolves.toEqual({ error: 'SMTP timeout' });
  });
});

describe('Queue management helpers', () => {
  const digests = resource.queue<{ kind: string }>('digests', { environment: 'production' });

  it('creates a schedule, falling back to an update when it exists', async () => {
    http.post.mockRejectedValueOnce(new ApiError('exists', 409, 'schedule_exists'));
    http.patch.mockResolvedValue({ name: 'daily' });

    await digests.schedule('daily', { cron: '0 8 * * *', timezone: 'Europe/Berlin', payload: { kind: 'digest' } });

    const input = {
      cron: '0 8 * * *',
      timezone: 'Europe/Berlin',
      body: '{"kind":"digest"}',
      contentType: 'application/json',
    };
    expect(http.post).toHaveBeenCalledWith(`/applications/${APP}/queues/digests/schedules`, {
      environment: 'production',
      name: 'daily',
      ...input,
    });
    expect(http.patch).toHaveBeenCalledWith(`/applications/${APP}/queues/digests/schedules/daily`, {
      environment: 'production',
      ...input,
    });
  });

  it('ensures, pauses, purges and redrives through the REST resource', async () => {
    http.put.mockResolvedValue({ name: 'digests', created: true });
    http.post
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ purgedMessages: 3 })
      .mockResolvedValueOnce({ redrivenMessages: 2 });

    await digests.ensure({ consumerPath: '/api/queues/digests', maxAttempts: 5 });
    await digests.pause();
    await expect(digests.purge('dead')).resolves.toBe(3);
    await expect(digests.redrive(['a', 'b'])).resolves.toBe(2);

    expect(http.put).toHaveBeenCalledWith(`/applications/${APP}/queues/digests`, {
      environment: 'production',
      consumerPath: '/api/queues/digests',
      maxAttempts: 5,
    });
    expect(http.post.mock.calls.map(([path]: [string]) => path)).toEqual([
      `/applications/${APP}/queues/digests/pause`,
      `/applications/${APP}/queues/digests/purge`,
      `/applications/${APP}/queues/digests/redrive`,
    ]);
  });

  it('encodes queue names and needs an application context', async () => {
    http.get.mockResolvedValue({ items: [], total: 0 });
    await resource.get('orders.v2:eu', { environment: 'preview' });
    expect(http.get).toHaveBeenCalledWith(`/applications/${APP}/queues/orders.v2%3Aeu`, {
      query: { environment: 'preview' },
    });

    const unbound = new QueuesResource(http as unknown as HttpClient);
    await expect(unbound.list()).rejects.toThrow('No application context');
  });
});

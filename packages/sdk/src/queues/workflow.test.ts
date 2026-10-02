import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GigadriveClient } from '../client';
import type { HttpClient } from '../http-client';
import { QueuesResource } from '../resources/queues';
import { signQueueDelivery } from './signature';
import { createWorkflowQueue } from './workflow';

const APP = '0197b2f1-2f4a-7a0b-8a2d-222222222222';
const DEPLOYMENT = '0197b2f1-2f4a-7a0b-8a2d-333333333333';
const SECRET = 'workflow-secret';
const QUEUE = '__wkf_workflow_workflow//src/workflows/signup.ts//handleSignup';

const http = { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() };
const client = { queues: new QueuesResource(http as unknown as HttpClient, APP) } as unknown as GigadriveClient;

const delivery = async (body: string, headers: Record<string, string> = {}) => {
  const fields = { queue: '__wkf_workflow_', messageId: 'msg-1', attempt: 3, body };
  return new Request('https://app.example/.well-known/workflow/v1/flow', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      'x-gigadrive-queue-name': fields.queue,
      'x-gigadrive-queue-message-id': fields.messageId,
      'x-gigadrive-queue-attempt': String(fields.attempt),
      'x-workflow-queue-name': QUEUE,
      'x-gigadrive-queue-signature': await signQueueDelivery({ ...fields, secret: SECRET }),
      ...headers,
    },
  });
};

beforeEach(() => {
  for (const fn of Object.values(http)) fn.mockReset();
  http.put.mockResolvedValue({ name: '__wkf_workflow_', created: true });
});

afterEach(() => vi.unstubAllEnvs());

describe('createWorkflowQueue', () => {
  it('reports the deployment from the environment', async () => {
    vi.stubEnv('GIGADRIVE_DEPLOYMENT_ID', DEPLOYMENT);
    await expect(createWorkflowQueue({ client }).getDeploymentId()).resolves.toBe(DEPLOYMENT);
    await expect(createWorkflowQueue({ client, deploymentId: 'explicit' }).getDeploymentId()).resolves.toBe('explicit');
  });

  it('ensures one push queue per prefix, then sends with delay, pinning and deduplication', async () => {
    http.post.mockResolvedValue({ messageId: 'msg-1', deduplicated: false, deliverAt: '2026-01-01T00:00:00.000Z' });
    const world = createWorkflowQueue({ client });
    const message = { runId: 'wrun_1', stepInput: { input: new Uint8Array([104, 105]) } };

    await expect(
      world.queue(QUEUE, message, {
        deploymentId: DEPLOYMENT,
        idempotencyKey: 'step:1',
        delaySeconds: 2.5,
        headers: { traceparent: '00-abc', 'x-gigadrive-queue-name': 'spoofed' },
      })
    ).resolves.toEqual({ messageId: 'msg-1' });
    await world.queue(`${QUEUE}-2`, { runId: 'wrun_2' }, { deploymentId: 'dpl_local@1.0.0' });

    expect(http.put).toHaveBeenCalledTimes(1);
    expect(http.put).toHaveBeenCalledWith(`/applications/${APP}/queues/__wkf_workflow_`, {
      environment: undefined,
      maxAttempts: 100,
      visibilityTimeoutSeconds: 300,
      deadLetter: true,
      consumerPath: '/.well-known/workflow/v1/flow',
    });
    const [path, first] = http.post.mock.calls[0]! as [string, Record<string, unknown>];
    expect(path).toBe(`/applications/${APP}/queues/__wkf_workflow_/messages`);
    expect(first).toMatchObject({
      autoCreate: false,
      contentType: 'application/json',
      headers: { traceparent: '00-abc', 'x-workflow-queue-name': QUEUE },
      delaySeconds: 3,
      deduplicationKey: 'step:1',
      deploymentId: DEPLOYMENT,
    });
    expect(JSON.parse(first.body as string)).toEqual({
      runId: 'wrun_1',
      stepInput: { input: { __type: 'Uint8Array', data: 'aGk=' } },
    });
    expect(http.post.mock.calls[1]![1]).not.toHaveProperty('deploymentId');
  });

  it('hashes idempotency keys longer than a deduplication key allows', async () => {
    http.post.mockResolvedValue({ messageId: 'msg-1', deduplicated: true, deliverAt: '2026-01-01T00:00:00.000Z' });
    const world = createWorkflowQueue({ client });

    await world.queue(QUEUE, {}, { idempotencyKey: 'k'.repeat(300) });
    await world.queue(QUEUE, {}, { idempotencyKey: 'k'.repeat(300) });

    const keys = http.post.mock.calls.map(([, body]: [string, { deduplicationKey: string }]) => body.deduplicationKey);
    expect(keys[0]).toMatch(/^wkf:sha256:[0-9a-f]{64}$/);
    expect(keys[1]).toBe(keys[0]);
  });

  it('retries ensuring the queue after a failure and rejects foreign queue names', async () => {
    http.put.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue({});
    http.post.mockResolvedValue({ messageId: 'msg-1', deduplicated: false, deliverAt: '2026-01-01T00:00:00.000Z' });
    const world = createWorkflowQueue({ client });

    await expect(world.queue(QUEUE, {})).rejects.toThrow('unavailable');
    await expect(world.queue(QUEUE, {})).resolves.toEqual({ messageId: 'msg-1' });
    await expect(world.queue('emails', {})).rejects.toThrow('not a Workflow SDK queue name');
  });

  it('publishes batches and reports per-message failures in order', async () => {
    http.post.mockResolvedValue({
      results: [
        { messageId: 'a', deduplicated: false, deliverAt: '2026-01-01T00:00:00.000Z' },
        { messageId: null, error: 'Storage limit reached', code: 'backlog_full', retryable: true },
      ],
    });
    const world = createWorkflowQueue({ client });

    await expect(world.queueBatch(QUEUE, [{ message: { n: 1 } }, { message: { n: 2 } }])).resolves.toEqual([
      { messageId: 'a' },
      { messageId: null, error: 'Storage limit reached', retryable: true },
    ]);
  });

  it('serves deliveries to the Workflow handler and turns timeoutSeconds into a deferral', async () => {
    const world = createWorkflowQueue({ client, signingSecret: SECRET });
    const handler = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce({ timeoutSeconds: 90.2 });
    const serve = world.createQueueHandler('__wkf_workflow_', handler);
    const body = JSON.stringify({ runId: 'wrun_1', stepInput: { input: { __type: 'Uint8Array', data: 'aGk=' } } });

    const acked = await serve(await delivery(body));
    expect(acked.status).toBe(200);
    expect(acked.headers.get('x-gigadrive-queue-retry-after')).toBeNull();
    expect(handler).toHaveBeenCalledWith(
      { runId: 'wrun_1', stepInput: { input: new Uint8Array([104, 105]) } },
      { attempt: 3, queueName: QUEUE, messageId: 'msg-1', requestId: undefined }
    );

    const deferred = await serve(await delivery(body));
    expect(deferred.status).toBe(200);
    expect(deferred.headers.get('x-gigadrive-queue-retry-after')).toBe('91');
    await expect(deferred.json()).resolves.toEqual({ timeoutSeconds: 90.2 });
  });

  it('answers invocations with the result and maps failures', async () => {
    const world = createWorkflowQueue({ client, signingSecret: SECRET });

    const invoked = await world.createQueueHandler('__wkf_workflow_', () => Promise.resolve({ value: 42 }))(
      await delivery(JSON.stringify({ runId: 'wrun_1', invoke: true }))
    );
    await expect(invoked.json()).resolves.toEqual({ result: { value: 42 } });

    const failed = await world.createQueueHandler('__wkf_workflow_', () => Promise.reject(new Error('replay failed')))(
      await delivery('{"runId":"wrun_1"}')
    );
    expect(failed.status).toBe(500);

    const malformed = await world.createQueueHandler('__wkf_workflow_', vi.fn())(await delivery('{oops'));
    expect(malformed.status).toBe(422);
    expect(malformed.headers.get('x-gigadrive-queue-action')).toBe('dead-letter');
  });

  it('rejects unsigned requests, other prefixes and requests missing headers', async () => {
    const world = createWorkflowQueue({ client, signingSecret: SECRET });
    const handler = vi.fn();

    const forged = await delivery('{"runId":"wrun_1"}', { 'x-gigadrive-queue-signature': 't=1,v1=00' });
    expect((await world.createQueueHandler('__wkf_workflow_', handler)(forged)).status).toBe(401);
    expect((await world.createQueueHandler('__team_wkf_workflow_', handler)(await delivery('{}'))).status).toBe(400);
    expect(
      (
        await world.createQueueHandler(
          '__wkf_workflow_',
          handler
        )(new Request('https://app.example/.well-known/workflow/v1/flow', { method: 'POST', body: '{}' }))
      ).status
    ).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });
});

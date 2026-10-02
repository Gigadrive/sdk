import type { GigadriveClient } from '../client';
import type { QueueMessageInput, QueueScopeOptions, QueueSettings, QueuesResource } from '../resources/queues';
import { defaultQueuesResource } from './default-client';
import { base64ToBytes, bytesToBase64, toArrayBuffer, toHex, utf8Decode, utf8Encode } from './encoding';
import { QUEUE_DELIVERY_HEADERS, QUEUE_RESPONSE_HEADERS, readSigningSecret } from './queue';
import { QUEUE_SIGNATURE_HEADER, verifyQueueSignature } from './signature';

/** Where the Workflow SDK serves its queue handler. */
export const WORKFLOW_CONSUMER_PATH = '/.well-known/workflow/v1/flow';

/** Carries the Workflow SDK's queue name, which Gigadrive queue names cannot always hold. */
export const WORKFLOW_QUEUE_NAME_HEADER = 'x-workflow-queue-name';

const WORKFLOW_PREFIX = /^__(?:[a-z][a-z0-9]*_)?wkf_workflow_/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESERVED_HEADER =
  /^(host|content-length|content-type|connection|transfer-encoding|te|upgrade|keep-alive|proxy-.*|authorization|cookie|x-gigadrive-.*|x-nebula-.*|x-substrate-.*|x-vercel-.*|x-forwarded-.*)$/i;

/** Options of a Workflow SDK queue send, as the Workflow runtime passes them. */
export interface WorkflowQueueSendOptions {
  deploymentId?: string;
  idempotencyKey?: string;
  headers?: Record<string, string>;
  delaySeconds?: number;
  specVersion?: number;
  region?: string;
}

/** What the Workflow runtime's handler learns about a delivery. */
export interface WorkflowQueueHandlerMeta<TMessageId extends string> {
  attempt: number;
  queueName: string;
  messageId: TMessageId;
  requestId?: string;
}

/**
 * The queue half of a Workflow SDK World, backed by Gigadrive Network
 * queues. It matches the World `Queue` interface of `@workflow/world`.
 */
export interface WorkflowQueue<TMessageId extends string = string> {
  getDeploymentId(): Promise<string>;
  queue(
    queueName: string,
    message: unknown,
    opts?: WorkflowQueueSendOptions
  ): Promise<{ messageId: TMessageId | null }>;
  queueBatch(
    queueName: string,
    messages: readonly { message: unknown; opts?: WorkflowQueueSendOptions }[]
  ): Promise<
    ({ messageId: TMessageId | null; error?: undefined } | { messageId: null; error: string; retryable: boolean })[]
  >;
  createQueueHandler(
    queueNamePrefix: string,
    handler: (message: unknown, meta: WorkflowQueueHandlerMeta<TMessageId>) => Promise<unknown>
  ): (request: Request) => Promise<Response>;
}

/** Options for {@link createWorkflowQueue}. */
export interface WorkflowQueueOptions extends QueueScopeOptions {
  /** Client for API calls. Defaults to a zero-config client, which works inside a deployment. */
  client?: GigadriveClient;
  /** Path of the Workflow handler on your deployment. Default `/.well-known/workflow/v1/flow`. */
  consumerPath?: string;
  /** Deployment id the Workflow runtime stamps on runs. Defaults to `GIGADRIVE_DEPLOYMENT_ID`. */
  deploymentId?: string;
  /**
   * Settings for the backing queue. Defaults: 100 attempts (the Workflow
   * runtime gives up earlier on its own) and a 300 second delivery timeout.
   */
  queueSettings?: Omit<QueueSettings, 'consumerPath'>;
  /** Push signing secret. Defaults to `GIGADRIVE_QUEUE_SIGNING_SECRET`. */
  signingSecret?: string;
  /** Accept unsigned deliveries. Local development only. */
  allowUnsigned?: boolean;
}

/**
 * JSON that keeps `Uint8Array` values, in the same tagged shape the
 * Workflow SDK's local World uses.
 */
const encodeWorkflowMessage = (message: unknown): string =>
  JSON.stringify(message, (_key, value: unknown) =>
    value instanceof Uint8Array ? { __type: 'Uint8Array', data: bytesToBase64(value) } : value
  );

const decodeWorkflowMessage = (text: string): unknown =>
  JSON.parse(text, (_key, value: unknown) => {
    if (
      typeof value === 'object' &&
      value !== null &&
      (value as { __type?: unknown }).__type === 'Uint8Array' &&
      typeof (value as { data?: unknown }).data === 'string'
    ) {
      return base64ToBytes((value as { data: string }).data);
    }
    return value;
  });

const readEnv = (name: string): string | undefined =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name] || undefined;

/** Keys longer than a deduplication key allows are hashed, keeping them stable across retries. */
const deduplicationKeyFor = async (idempotencyKey: string): Promise<string> =>
  idempotencyKey.length <= 256
    ? idempotencyKey
    : `wkf:sha256:${toHex(await crypto.subtle.digest('SHA-256', toArrayBuffer(utf8Encode(idempotencyKey))))}`;

/**
 * Runs the [Workflow SDK](https://workflow-sdk.dev) on Gigadrive Network
 * queues: returns the World `Queue` implementation (`getDeploymentId`,
 * `queue`, `queueBatch`, `createQueueHandler`).
 *
 * Every Workflow queue with the same prefix shares one push queue named
 * after the prefix (such as `__wkf_workflow_`), created on first use and
 * delivering to `/.well-known/workflow/v1/flow`. Sleeps and step timeouts
 * reschedule the message without spending attempts, deliveries are pinned
 * to the run's deployment, and idempotency keys become deduplication keys.
 *
 * @typeParam TMessageId - Pass the World's `MessageId` type so the result
 *   satisfies `@workflow/world`'s branded message ids.
 *
 * @example
 * ```ts
 * import type { MessageId, World } from '@workflow/world';
 * import { createWorkflowQueue } from '@gigadrive/sdk';
 *
 * export const world: World = { ...createWorkflowQueue<MessageId>(), ...storage, ...streamer };
 * ```
 */
export function createWorkflowQueue<TMessageId extends string = string>(
  options: WorkflowQueueOptions = {}
): WorkflowQueue<TMessageId> {
  const resource = (): QueuesResource => options.client?.queues ?? defaultQueuesResource();
  const scope: QueueScopeOptions = { applicationId: options.applicationId, environment: options.environment };
  const ensured = new Map<string, Promise<unknown>>();

  /** One physical queue per Workflow prefix, created or updated once per process. */
  const physicalQueue = async (queueName: string): Promise<string> => {
    const prefix = WORKFLOW_PREFIX.exec(queueName)?.[0];
    if (!prefix) throw new Error(`"${queueName}" is not a Workflow SDK queue name`);
    let ready = ensured.get(prefix);
    if (!ready) {
      ready = resource().ensure(
        prefix,
        {
          maxAttempts: 100,
          visibilityTimeoutSeconds: 300,
          deadLetter: true,
          ...options.queueSettings,
          consumerPath: options.consumerPath ?? WORKFLOW_CONSUMER_PATH,
        },
        scope
      );
      ensured.set(prefix, ready);
      ready.catch(() => ensured.delete(prefix));
    }
    await ready;
    return prefix;
  };

  const toMessage = async (
    queueName: string,
    message: unknown,
    opts: WorkflowQueueSendOptions = {}
  ): Promise<QueueMessageInput> => {
    const headers = Object.fromEntries(
      Object.entries(opts.headers ?? {}).filter(([name]) => !RESERVED_HEADER.test(name))
    );
    headers[WORKFLOW_QUEUE_NAME_HEADER] = queueName;
    return {
      body: encodeWorkflowMessage(message),
      contentType: 'application/json',
      headers,
      ...(opts.delaySeconds && opts.delaySeconds > 0 ? { delaySeconds: Math.ceil(opts.delaySeconds) } : {}),
      ...(opts.idempotencyKey ? { deduplicationKey: await deduplicationKeyFor(opts.idempotencyKey) } : {}),
      ...(opts.deploymentId && UUID.test(opts.deploymentId) ? { deploymentId: opts.deploymentId } : {}),
    };
  };

  return {
    getDeploymentId: () => Promise.resolve(options.deploymentId ?? readEnv('GIGADRIVE_DEPLOYMENT_ID') ?? 'local'),

    async queue(queueName, message, opts) {
      const physical = await physicalQueue(queueName);
      const result = await resource().send(physical, await toMessage(queueName, message, opts), {
        ...scope,
        autoCreate: false,
      });
      if (result.messageId === null) throw new Error(`Workflow message was refused: ${result.error}`);
      return { messageId: result.messageId as TMessageId };
    },

    async queueBatch(queueName, messages) {
      const physical = await physicalQueue(queueName);
      const results: Awaited<ReturnType<WorkflowQueue<TMessageId>['queueBatch']>> = [];
      for (let index = 0; index < messages.length; index += 100) {
        const chunk = messages.slice(index, index + 100);
        const sent = await resource().sendBatch(
          physical,
          await Promise.all(chunk.map(({ message, opts }) => toMessage(queueName, message, opts))),
          { ...scope, autoCreate: false }
        );
        for (const result of sent) {
          results.push(
            result.messageId === null
              ? { messageId: null, error: result.error, retryable: result.retryable }
              : { messageId: result.messageId as TMessageId }
          );
        }
      }
      return results;
    },

    createQueueHandler(queueNamePrefix, handler) {
      return async (request) => {
        const messageId = request.headers.get(QUEUE_DELIVERY_HEADERS.messageId);
        const physicalName = request.headers.get(QUEUE_DELIVERY_HEADERS.name);
        const attempt = Number(request.headers.get(QUEUE_DELIVERY_HEADERS.attempt) ?? '1');
        const queueName = request.headers.get(WORKFLOW_QUEUE_NAME_HEADER);
        if (!messageId || !physicalName || !queueName) {
          return Response.json({ error: 'Missing required headers' }, { status: 400 });
        }
        const body = new Uint8Array(await request.arrayBuffer());

        if (!options.allowUnsigned) {
          const secret = options.signingSecret ?? readSigningSecret();
          const valid =
            secret !== undefined &&
            (await verifyQueueSignature(request.headers.get(QUEUE_SIGNATURE_HEADER), {
              secret,
              queue: physicalName,
              messageId,
              attempt,
              body,
            }));
          if (!valid) return Response.json({ error: 'Invalid queue signature' }, { status: 401 });
        }
        if (!queueName.startsWith(queueNamePrefix)) {
          return Response.json({ error: 'Unhandled queue' }, { status: 400 });
        }

        let message: unknown;
        try {
          message = decodeWorkflowMessage(utf8Decode(body));
        } catch {
          return Response.json(
            { error: 'Malformed workflow message' },
            { status: 422, headers: { [QUEUE_RESPONSE_HEADERS.action]: 'dead-letter' } }
          );
        }

        try {
          const result = await handler(message, {
            attempt,
            queueName,
            messageId: messageId as TMessageId,
            requestId: request.headers.get('x-request-id') ?? undefined,
          });
          if (typeof message === 'object' && message !== null && (message as { invoke?: unknown }).invoke === true) {
            return Response.json({ result });
          }
          const timeoutSeconds =
            typeof result === 'object' && result !== null
              ? (result as { timeoutSeconds?: unknown }).timeoutSeconds
              : undefined;
          if (typeof timeoutSeconds === 'number' && Number.isFinite(timeoutSeconds) && timeoutSeconds >= 0) {
            return Response.json(
              { timeoutSeconds },
              { headers: { [QUEUE_RESPONSE_HEADERS.retryAfter]: String(Math.ceil(timeoutSeconds)) } }
            );
          }
          return Response.json({ ok: true });
        } catch (error) {
          return Response.json(String(error), { status: 500 });
        }
      };
    },
  };
}

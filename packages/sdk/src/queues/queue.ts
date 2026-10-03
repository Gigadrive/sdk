import { ApiError, ConfigurationError } from '../errors';
import type {
  QueueInfo,
  QueueMessageInput,
  QueueMessageRecord,
  QueueSchedule,
  QueueScopeOptions,
  QueueSettings,
  QueuesResource,
} from '../resources/queues';
import {
  base64ToBytes,
  bytesToBase64,
  durationToSeconds,
  type QueueDuration,
  utf8Decode,
  utf8Encode,
} from './encoding';
import { NonRetryableError, RetryLaterError } from './errors';
import { QUEUE_SIGNATURE_HEADER, QUEUE_SIGNING_SECRET_ENV, verifyQueueSignature } from './signature';

/** Headers the platform sets on a push delivery. */
export const QUEUE_DELIVERY_HEADERS = {
  name: 'x-gigadrive-queue-name',
  messageId: 'x-gigadrive-queue-message-id',
  attempt: 'x-gigadrive-queue-attempt',
  createdAt: 'x-gigadrive-queue-created-at',
  expiresAt: 'x-gigadrive-queue-expires-at',
  deadline: 'x-gigadrive-queue-deadline',
  groupKey: 'x-gigadrive-queue-group-key',
  deduplicationKey: 'x-gigadrive-queue-deduplication-key',
  deploymentId: 'x-gigadrive-queue-deployment-id',
  deploymentFallback: 'x-gigadrive-queue-deployment-fallback',
  signature: QUEUE_SIGNATURE_HEADER,
} as const;

/** Headers a push consumer sets on its response to steer redelivery. */
export const QUEUE_RESPONSE_HEADERS = {
  /** On a 2xx: deliver again after this many seconds without spending an attempt. */
  retryAfter: 'x-gigadrive-queue-retry-after',
  /** `dead-letter`: stop retrying now, whatever the status. */
  action: 'x-gigadrive-queue-action',
  /** Reason recorded on the message. */
  error: 'x-gigadrive-queue-error',
} as const;

/** Serializes payloads to message bodies and back. */
export interface QueueCodec<T> {
  encode(payload: T): { body: string; encoding: 'utf8' | 'base64'; contentType: string };
  decode(body: Uint8Array, contentType: string): T;
}

const isJsonContentType = (contentType: string) => /^application\/(?:[\w.+-]+\+)?json\b/i.test(contentType);

/**
 * The default codec. `Uint8Array` and `ArrayBuffer` payloads travel as raw
 * bytes (`application/octet-stream`); everything else as JSON. On the way
 * back, JSON content types are parsed, `text/*` becomes a string and
 * anything else a `Uint8Array`.
 */
export const defaultQueueCodec: QueueCodec<unknown> = {
  encode(payload) {
    if (payload instanceof Uint8Array || payload instanceof ArrayBuffer) {
      const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
      return { body: bytesToBase64(bytes), encoding: 'base64', contentType: 'application/octet-stream' };
    }
    const json = JSON.stringify(payload);
    if (json === undefined) throw new TypeError('Queue payloads must be JSON-serializable or binary');
    return { body: json, encoding: 'utf8', contentType: 'application/json' };
  },
  decode(body, contentType) {
    if (isJsonContentType(contentType)) return body.length === 0 ? null : (JSON.parse(utf8Decode(body)) as unknown);
    if (/^text\//i.test(contentType)) return utf8Decode(body);
    return body;
  },
};

/** Options for a {@link Queue} handle. */
export interface QueueOptions<T> extends QueueScopeOptions {
  /** Body serialization. Defaults to {@link defaultQueueCodec}. */
  codec?: QueueCodec<T>;
  /**
   * Validates every decoded payload before your handler sees it, for example
   * a Zod schema's `parse`. A payload that fails is dead-lettered, since
   * retrying cannot fix it.
   */
  validate?: (payload: unknown) => T;
  /** Create a pull queue with default settings on the first send to a new name. Default `true`. */
  autoCreate?: boolean;
  /** Push signing secret. Defaults to `GIGADRIVE_QUEUE_SIGNING_SECRET`, which deployments receive. */
  signingSecret?: string;
  /**
   * Accept push deliveries without a valid signature. Only for local
   * development: anyone who can reach the endpoint could then inject messages.
   */
  allowUnsigned?: boolean;
}

/** Options for one send. */
export interface QueueSendOptions {
  /** Deliver after this delay, such as `'10m'` or `90` seconds. Up to one year. */
  delay?: QueueDuration;
  /** Deliver at this time, up to one year ahead. Wins over {@link delay}. */
  at?: Date | string | number;
  /** Messages with the same key are delivered one at a time, in send order. */
  groupKey?: string;
  /** A repeat of this key within the queue's deduplication window is dropped and returns the first id. */
  deduplicationKey?: string;
  /** Deliver to this deployment instead of the environment's current one. */
  deploymentId?: string;
  /** Extra headers sent with push deliveries. */
  headers?: Record<string, string>;
}

/** A message that was accepted. */
export interface QueueSent {
  messageId: string;
  /** `true` when the deduplication key matched an earlier message, whose id this is. */
  deduplicated: boolean;
  /** When the message becomes deliverable. */
  deliverAt: Date;
}

/** Per-message outcome of {@link Queue.sendBatch}, in input order. */
export type QueueBatchSent = (QueueSent & { error?: undefined }) | { messageId: null; error: ApiError };

/** What a handler knows about the message it is processing. */
export interface QueueMessageMeta {
  messageId: string;
  queue: string;
  /** 1 on the first delivery. Deferrals with {@link RetryLaterError} do not count. */
  attempt: number;
  createdAt: Date | null;
  groupKey: string | null;
  deduplicationKey: string | null;
  /** Push: the deployment serving this delivery. Pull: the deployment the message was pinned to, if any. */
  deploymentId: string | null;
  /** Message headers, as sent. */
  headers: Record<string, string>;
}

/** A leased message from {@link Queue.receive}. Settle it before its lease ends. */
export interface ReceivedQueueMessage<T> extends QueueMessageMeta {
  payload: T;
  receipt: string;
  leaseExpiresAt: Date | null;
  /** Deletes the message: processing succeeded. */
  ack(): Promise<void>;
  /** Releases the message for another attempt, after backoff or `delay`. */
  retry(options?: { delay?: QueueDuration; error?: string }): Promise<void>;
  /** Releases the message for later without spending an attempt. */
  defer(delay: QueueDuration): Promise<void>;
  /** Moves the message to the dead-letter list now. */
  deadLetter(reason?: string): Promise<void>;
  /** Extends the lease to `duration` from now. */
  extendLease(duration: QueueDuration): Promise<void>;
}

/** A function that processes one message. Throw to retry. */
export type QueueMessageHandler<T> = (payload: T, meta: QueueMessageMeta) => unknown;

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 2_000);

/** Header-safe, single-line error text. */
const headerText = (text: string) =>
  text
    .replace(/[^\x20-\x7e]/g, ' ')
    .trim()
    .slice(0, 500);

const toDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(/^\d+$/.test(value) ? Number(value) : value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const BATCH_LIMIT = 100;
/** {@link Queue.consume} gathers acknowledgements this long into one batch request. */
const ACK_FLUSH_MS = 25;
/** Pauses before each retry of a batch acknowledgement that failed in transit or with a 5xx or 429. */
const ACK_RETRY_DELAYS_MS = [200, 1_000];
/** Shortest and longest pause after an empty receive in {@link Queue.consume}. */
const EMPTY_POLL_MIN_MS = 1_000;
const EMPTY_POLL_MAX_MS = 5_000;

/** Resolves after `ms`, or as soon as `signal` aborts. */
const sleep = (ms: number, signal: AbortSignal | undefined) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    }
    signal?.addEventListener('abort', done, { once: true });
  });

/**
 * A typed handle on one queue: send messages, receive and process them, or
 * serve them as a push consumer.
 *
 * Get one with the top-level {@link queue} function (zero-config inside a
 * deployment) or with `client.queues.queue(name)`.
 *
 * @typeParam T - The payload type.
 */
export class Queue<T = unknown> {
  private readonly codec: QueueCodec<T>;

  constructor(
    /** The queue name. */
    readonly name: string,
    private readonly resource: () => QueuesResource,
    private readonly options: QueueOptions<T> = {}
  ) {
    this.codec = options.codec ?? (defaultQueueCodec as QueueCodec<T>);
  }

  private get scope(): QueueScopeOptions {
    return { applicationId: this.options.applicationId, environment: this.options.environment };
  }

  private toMessage(payload: T, options: QueueSendOptions = {}): QueueMessageInput {
    const encoded = this.codec.encode(payload);
    const at = options.at === undefined ? undefined : new Date(options.at);
    if (at && Number.isNaN(at.getTime())) throw new ConfigurationError('Invalid `at` time for a queue message');
    return {
      body: encoded.body,
      encoding: encoded.encoding,
      contentType: encoded.contentType,
      ...(options.headers ? { headers: options.headers } : {}),
      ...(at ? { deliverAt: at.toISOString() } : {}),
      ...(options.delay !== undefined && !at ? { delaySeconds: durationToSeconds(options.delay) } : {}),
      ...(options.groupKey ? { groupKey: options.groupKey } : {}),
      ...(options.deduplicationKey ? { deduplicationKey: options.deduplicationKey } : {}),
      ...(options.deploymentId ? { deploymentId: options.deploymentId } : {}),
    };
  }

  private decode(body: Uint8Array, contentType: string): T {
    const decoded = this.codec.decode(body, contentType);
    return this.options.validate ? this.options.validate(decoded) : decoded;
  }

  /**
   * Sends one message.
   *
   * @example
   * ```ts
   * await emails.send({ to: 'jane@example.com' });
   * await emails.send({ to: 'jane@example.com' }, { delay: '10m' });
   * await emails.send(reminder, { at: new Date('2027-01-01T09:00:00Z'), deduplicationKey: `reminder:${id}` });
   * ```
   *
   * @throws {@link ApiError} when the message is refused, for example with
   *   `code: 'backlog_full'` when your organization's queued storage is full.
   */
  async send(payload: T, options?: QueueSendOptions): Promise<QueueSent> {
    const result = await this.resource().send(this.name, this.toMessage(payload, options), {
      ...this.scope,
      autoCreate: this.options.autoCreate,
    });
    if (result.messageId === null) throw new ApiError(result.error, 429, result.code);
    return { messageId: result.messageId, deduplicated: result.deduplicated, deliverAt: new Date(result.deliverAt) };
  }

  /**
   * Sends many messages, 100 per request. Results come back in input order;
   * a refused message does not fail the rest.
   */
  async sendBatch(messages: readonly ({ payload: T } & QueueSendOptions)[]): Promise<QueueBatchSent[]> {
    const results: QueueBatchSent[] = [];
    for (let index = 0; index < messages.length; index += BATCH_LIMIT) {
      const chunk = messages.slice(index, index + BATCH_LIMIT);
      const sent = await this.resource().sendBatch(
        this.name,
        chunk.map(({ payload, ...options }) => this.toMessage(payload, options)),
        { ...this.scope, autoCreate: this.options.autoCreate }
      );
      for (const result of sent) {
        results.push(
          result.messageId === null
            ? { messageId: null, error: new ApiError(result.error, 429, result.code) }
            : { messageId: result.messageId, deduplicated: result.deduplicated, deliverAt: new Date(result.deliverAt) }
        );
      }
    }
    return results;
  }

  /** Deletes a message that has not been processed yet, such as a scheduled send. */
  async cancel(messageId: string): Promise<void> {
    await this.resource().deleteMessage(this.name, messageId, this.scope);
  }

  /**
   * Leases messages from a pull queue. Waits up to `wait` (at most 20
   * seconds) for the first message, then returns what is available.
   */
  async receive(
    options: {
      maxMessages?: number;
      wait?: QueueDuration;
      visibilityTimeout?: QueueDuration;
      signal?: AbortSignal;
    } = {}
  ): Promise<ReceivedQueueMessage<T>[]> {
    const records = await this.resource().receive(
      this.name,
      {
        maxMessages: options.maxMessages ?? 1,
        ...(options.wait === undefined ? {} : { waitSeconds: Math.min(durationToSeconds(options.wait), 20) }),
        ...(options.visibilityTimeout === undefined
          ? {}
          : { visibilityTimeoutSeconds: durationToSeconds(options.visibilityTimeout) }),
      },
      { ...this.scope, signal: options.signal }
    );
    return records.map((record) => this.toReceived(record));
  }

  private toReceived(record: QueueMessageRecord): ReceivedQueueMessage<T> {
    const resource = this.resource();
    const receipt = record.receipt ?? '';
    const bytes = record.encoding === 'base64' ? base64ToBytes(record.body) : utf8Encode(record.body);
    const nack = (request: { delaySeconds?: number; deadLetter?: boolean; countAttempt?: boolean; error?: string }) =>
      resource.nack(this.name, record.id, { receipt, ...request }, this.scope).then(() => undefined);
    let payload: T | undefined;
    let decodeError: unknown;
    try {
      payload = this.decode(bytes, record.contentType);
    } catch (error) {
      decodeError = error;
    }
    return {
      messageId: record.id,
      queue: this.name,
      attempt: record.attempts,
      createdAt: toDate(record.createdAt),
      groupKey: record.groupKey,
      deduplicationKey: record.deduplicationKey,
      deploymentId: record.deploymentId,
      headers: record.headers,
      receipt,
      leaseExpiresAt: toDate(record.leaseExpiresAt),
      get payload(): T {
        if (decodeError !== undefined) throw new NonRetryableError(`Undecodable payload: ${errorText(decodeError)}`);
        return payload as T;
      },
      ack: () => resource.ack(this.name, record.id, receipt, this.scope).then(() => undefined),
      retry: (options = {}) =>
        nack({
          ...(options.delay === undefined ? {} : { delaySeconds: durationToSeconds(options.delay) }),
          ...(options.error ? { error: options.error } : {}),
        }),
      defer: (delay) => nack({ delaySeconds: durationToSeconds(delay), countAttempt: false }),
      deadLetter: (reason) => nack({ deadLetter: true, ...(reason ? { error: reason } : {}) }),
      extendLease: (duration) =>
        resource.extend(this.name, record.id, receipt, durationToSeconds(duration), this.scope).then(() => undefined),
    };
  }

  /**
   * Receives and processes messages until `signal` aborts, or until the queue
   * is empty with `stopWhenEmpty`. A handler that returns acknowledges the
   * message; {@link RetryLaterError} defers it, {@link NonRetryableError}
   * dead-letters it, and any other error retries it with backoff.
   *
   * @example
   * ```ts
   * const controller = new AbortController();
   * await jobs.consume(async (job) => processJob(job), { maxMessages: 10, signal: controller.signal });
   * ```
   */
  async consume(
    handler: QueueMessageHandler<T>,
    options: {
      maxMessages?: number;
      wait?: QueueDuration;
      visibilityTimeout?: QueueDuration;
      signal?: AbortSignal;
      stopWhenEmpty?: boolean;
      /** Called when settling a message fails; the message is then redelivered after its lease. */
      onError?: (error: unknown) => void;
    } = {}
  ): Promise<void> {
    const wait = options.wait ?? (options.stopWhenEmpty ? 0 : 20);
    const waitMs = Math.min(durationToSeconds(wait), 20) * 1000;
    // Handlers that finish within ACK_FLUSH_MS of each other are acknowledged
    // in one request instead of one each.
    const pending: { message: ReceivedQueueMessage<T>; settled: (error?: unknown) => void }[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    /**
     * Acknowledges one batch; resolves with one error (or `undefined`) per
     * message. A failed request is retried, since a lost acknowledgement makes
     * finished work run again; on a retry, `message_not_found` means an earlier
     * attempt landed. An API without the batch route gets one request per message.
     */
    const sendAcks = async (batch: ReceivedQueueMessage<T>[]): Promise<(Error | undefined)[]> => {
      const resource = this.resource();
      for (let attempt = 0; ; attempt += 1) {
        try {
          const { results } = await resource.ackBatch(
            this.name,
            batch.map((message) => ({ messageId: message.messageId, receipt: message.receipt })),
            this.scope
          );
          return batch.map((_message, index) => {
            const result = results[index];
            if (result?.acknowledged || (attempt > 0 && result?.code === 'message_not_found')) return undefined;
            const code = result?.code ?? 'no_result';
            return new ApiError(
              `Acknowledging message failed: ${code}`,
              code === 'message_not_found' ? 404 : 409,
              code
            );
          });
        } catch (error) {
          if (error instanceof ApiError && error.status === 404 && error.code !== 'queue_not_found') {
            const settled = await Promise.allSettled(
              batch.map((message) => resource.ack(this.name, message.messageId, message.receipt, this.scope))
            );
            return settled.map((outcome) =>
              outcome.status === 'fulfilled'
                ? undefined
                : outcome.reason instanceof Error
                  ? outcome.reason
                  : new Error(errorText(outcome.reason))
            );
          }
          const retryable = !(error instanceof ApiError) || error.status >= 500 || error.status === 429;
          const delay = ACK_RETRY_DELAYS_MS[attempt];
          if (!retryable || delay === undefined) throw error;
          await sleep(delay, undefined);
        }
      }
    };
    const flush = () => {
      clearTimeout(timer);
      timer = undefined;
      const batch = pending.splice(0, BATCH_LIMIT);
      if (pending.length > 0) timer = setTimeout(flush, 0);
      if (batch.length === 0) return;
      sendAcks(batch.map(({ message }) => message))
        .then((errors) => batch.forEach(({ settled }, index) => settled(errors[index])))
        // Settling twice is a no-op, so a malformed answer still settles every message.
        .catch((error: unknown) => batch.forEach(({ settled }) => settled(error)));
    };
    const acknowledge = (message: ReceivedQueueMessage<T>) =>
      new Promise<void>((resolve, reject) => {
        pending.push({
          message,
          settled: (error) => {
            if (error === undefined) resolve();
            else reject(error instanceof Error ? error : new Error(errorText(error)));
          },
        });
        if (pending.length >= BATCH_LIMIT) flush();
        else timer ??= setTimeout(flush, ACK_FLUSH_MS);
      });
    while (!options.signal?.aborted) {
      let messages: ReceivedQueueMessage<T>[];
      const started = Date.now();
      try {
        messages = await this.receive({
          maxMessages: options.maxMessages ?? 10,
          wait,
          visibilityTimeout: options.visibilityTimeout,
          signal: options.signal,
        });
      } catch (error) {
        if (options.signal?.aborted) return;
        throw error;
      }
      if (messages.length === 0) {
        if (options.stopWhenEmpty) return;
        // An empty answer that came back early (a paused queue, or `wait: 0`)
        // would otherwise turn this loop into a tight polling loop.
        const remaining = Math.max(waitMs, EMPTY_POLL_MIN_MS) - (Date.now() - started);
        if (remaining > 0) await sleep(Math.min(remaining, EMPTY_POLL_MAX_MS), options.signal);
        continue;
      }
      await Promise.all(
        messages.map(async (message) => {
          let outcome: Promise<void>;
          try {
            await handler(message.payload, message);
            outcome = acknowledge(message);
          } catch (error) {
            outcome =
              error instanceof RetryLaterError
                ? message.defer(error.delaySeconds)
                : error instanceof NonRetryableError
                  ? message.deadLetter(error.message)
                  : message.retry({ error: errorText(error) });
          }
          // A failed settle is reported, never mistaken for a failed handler: the
          // message comes back when its lease ends, and is not retried or
          // dead-lettered for work that succeeded.
          try {
            await outcome;
          } catch (settleError) {
            options.onError?.(settleError);
          }
        })
      );
    }
  }

  /**
   * Builds a push consumer: a `(request: Request) => Promise<Response>`
   * function for the queue's consumer path, such as a Next.js route handler.
   *
   * It verifies the delivery signature, decodes the payload and calls
   * `handler`. Returning acknowledges the message. Throw
   * {@link RetryLaterError} to defer it without spending an attempt,
   * {@link NonRetryableError} to dead-letter it, or anything else to retry
   * with backoff.
   *
   * @example
   * ```ts
   * // app/api/queues/emails/route.ts
   * export const POST = emails.handler(async (email, { attempt }) => {
   *   await sendEmail(email);
   * });
   * ```
   */
  handler(handler: QueueMessageHandler<T>): (request: Request) => Promise<Response> {
    return async (request) => {
      const header = (name: string) => request.headers.get(name);
      const messageId = header(QUEUE_DELIVERY_HEADERS.messageId);
      const queueName = header(QUEUE_DELIVERY_HEADERS.name);
      const attempt = Number(header(QUEUE_DELIVERY_HEADERS.attempt) ?? '1');
      if (!messageId || !queueName) {
        return Response.json({ error: 'Not a queue delivery' }, { status: 400 });
      }
      // The signature covers the queue name: refuse another queue's delivery, so a captured
      // request cannot be replayed here, and two queues sharing one route is caught early.
      if (queueName !== this.name) {
        console.error(`[gigadrive] Rejected a delivery for queue "${queueName}" at the handler of "${this.name}"`);
        return Response.json({ error: `This endpoint consumes queue "${this.name}"` }, { status: 400 });
      }
      const body = new Uint8Array(await request.arrayBuffer());

      if (!this.options.allowUnsigned) {
        const secret = this.options.signingSecret ?? readSigningSecret();
        if (!secret) {
          console.error(
            `[gigadrive] Rejected a queue delivery: ${QUEUE_SIGNING_SECRET_ENV} is not set. Deployments receive it automatically; set allowUnsigned for local development.`
          );
          return Response.json({ error: 'Queue signing secret is not configured' }, { status: 500 });
        }
        const valid = await verifyQueueSignature(header(QUEUE_SIGNATURE_HEADER), {
          secret,
          queue: queueName,
          messageId,
          attempt,
          body,
        });
        if (!valid) return Response.json({ error: 'Invalid queue signature' }, { status: 401 });
      }

      const meta: QueueMessageMeta = {
        messageId,
        queue: queueName,
        attempt,
        createdAt: toDate(header(QUEUE_DELIVERY_HEADERS.createdAt)),
        groupKey: header(QUEUE_DELIVERY_HEADERS.groupKey),
        deduplicationKey: header(QUEUE_DELIVERY_HEADERS.deduplicationKey),
        deploymentId: header(QUEUE_DELIVERY_HEADERS.deploymentId),
        headers: Object.fromEntries(
          [...request.headers.entries()].filter(([name]) => !name.startsWith('x-gigadrive-queue-'))
        ),
      };

      let payload: T;
      try {
        payload = this.decode(body, header('content-type') ?? 'application/octet-stream');
      } catch (error) {
        return deadLetterResponse(`Undecodable payload: ${errorText(error)}`);
      }

      try {
        await handler(payload, meta);
        return Response.json({ ok: true });
      } catch (error) {
        if (error instanceof RetryLaterError) {
          return Response.json(
            { ok: true, retryAfter: error.delaySeconds },
            { headers: { [QUEUE_RESPONSE_HEADERS.retryAfter]: String(error.delaySeconds) } }
          );
        }
        if (error instanceof NonRetryableError) return deadLetterResponse(error.message);
        console.error(`[gigadrive] Queue handler for "${queueName}" failed (attempt ${String(attempt)})`, error);
        return Response.json(
          { error: errorText(error) },
          { status: 500, headers: { [QUEUE_RESPONSE_HEADERS.error]: headerText(errorText(error)) } }
        );
      }
    };
  }

  /** Creates the queue, or applies `settings` to it. Use it to make a push queue from code. */
  async ensure(settings: QueueSettings = {}): Promise<QueueInfo> {
    return this.resource().ensure(this.name, settings, this.scope);
  }

  /** The queue's settings and live depth. */
  async info(): Promise<QueueInfo> {
    return this.resource().get(this.name, this.scope);
  }

  /** Stops deliveries until {@link resume}. Sends are still accepted. */
  async pause(): Promise<void> {
    await this.resource().pause(this.name, this.scope);
  }

  async resume(): Promise<void> {
    await this.resource().resume(this.name, this.scope);
  }

  /** Deletes every message, or only the dead letters. */
  async purge(scope: 'all' | 'dead' = 'all'): Promise<number> {
    return (await this.resource().purge(this.name, scope, this.scope)).purgedMessages;
  }

  /** Moves dead letters back for another round of attempts. */
  async redrive(messageIds?: string[]): Promise<number> {
    return (await this.resource().redrive(this.name, messageIds, this.scope)).redrivenMessages;
  }

  /**
   * Creates or updates a cron schedule that sends `payload` into this queue.
   *
   * @example
   * ```ts
   * await digests.schedule('weekday-digest', { cron: '0 8 * * MON-FRI', timezone: 'Europe/Berlin', payload: { kind: 'digest' } });
   * ```
   */
  async schedule(
    name: string,
    schedule: { cron: string; timezone?: string; payload?: T; headers?: Record<string, string>; enabled?: boolean }
  ): Promise<QueueSchedule> {
    const encoded = schedule.payload === undefined ? undefined : this.codec.encode(schedule.payload);
    if (encoded?.encoding === 'base64') throw new ConfigurationError('Scheduled payloads must be text or JSON');
    const input = {
      cron: schedule.cron,
      ...(schedule.timezone ? { timezone: schedule.timezone } : {}),
      ...(encoded ? { body: encoded.body, contentType: encoded.contentType } : {}),
      ...(schedule.headers ? { headers: schedule.headers } : {}),
      ...(schedule.enabled === undefined ? {} : { enabled: schedule.enabled }),
    };
    try {
      return await this.resource().createSchedule(this.name, name, input, this.scope);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'schedule_exists') {
        return this.resource().updateSchedule(this.name, name, input, this.scope);
      }
      throw error;
    }
  }

  /** Deletes a schedule. */
  async unschedule(name: string): Promise<void> {
    await this.resource().deleteSchedule(this.name, name, this.scope);
  }
}

const deadLetterResponse = (reason: string) =>
  Response.json(
    { error: reason },
    {
      status: 422,
      headers: { [QUEUE_RESPONSE_HEADERS.action]: 'dead-letter', [QUEUE_RESPONSE_HEADERS.error]: headerText(reason) },
    }
  );

/** @internal */
export const readSigningSecret = (): string | undefined => {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.[QUEUE_SIGNING_SECRET_ENV] || undefined;
};

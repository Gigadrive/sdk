import type { HttpClient } from '../http-client';
import { Queue, type QueueOptions } from '../queues/queue';
import { BaseResource } from './base-resource';
import { resolveStorageApplicationId } from './storage-context';

/** Live depth and lifetime counters of a queue. */
export interface QueueStats {
  /** Messages ready for delivery now. */
  ready: number;
  /** Messages delayed or scheduled for later. */
  scheduled: number;
  /** Messages held behind an earlier message of the same ordering group. */
  waiting: number;
  /** Messages being delivered or leased by a consumer. */
  inflight: number;
  /** Messages in the dead-letter list. */
  dead: number;
  /** Bytes held by the queue, dead letters included. */
  bytes: number;
  sent: number;
  acknowledged: number;
  failed: number;
  deadLettered: number;
  /** ISO 8601 time the oldest ready message became deliverable. */
  oldestReadyAt: string | null;
  /** ISO 8601 time of the next scheduled delivery. */
  nextScheduledAt: string | null;
}

/** A queue in one application environment. */
export interface QueueInfo {
  id: string;
  name: string;
  applicationId: string;
  environmentId: string;
  /** `push` queues POST each message to {@link consumerPath}; `pull` queues are drained with receive. */
  mode: 'push' | 'pull';
  consumerPath: string | null;
  visibilityTimeoutSeconds: number;
  retentionSeconds: number;
  maxAttempts: number;
  retryBackoffMinSeconds: number;
  retryBackoffMaxSeconds: number;
  deduplicationWindowSeconds: number;
  concurrency: number | null;
  rateLimit: { count: number; periodSeconds: number } | null;
  deadLetter: boolean;
  paused: boolean;
  pausedAt: string | null;
  /** How the queue was created: `config`, `api` or `auto` (first send). */
  source: string;
  createdAt: string;
  updatedAt: string;
  /** Present on list and get responses. */
  stats?: QueueStats;
}

/** Settings accepted when creating or updating a queue. Omitted settings keep their current value or default. */
export interface QueueSettings {
  /** Deployment-relative path that receives push deliveries. `null` makes the queue a pull queue. */
  consumerPath?: string | null;
  /** Push delivery timeout and default pull lease, 1 to 43,200 seconds. Default 60. */
  visibilityTimeoutSeconds?: number;
  /** How long an undelivered message is kept, 60 to 1,209,600 seconds. Default four days. */
  retentionSeconds?: number;
  /** Deliveries before a message is dead-lettered, 1 to 100. Default 10. */
  maxAttempts?: number;
  /** First retry delay. Default 5 seconds. */
  retryBackoffMinSeconds?: number;
  /** Longest retry delay. Default 900 seconds. */
  retryBackoffMaxSeconds?: number;
  /** How long a deduplication key is remembered, up to seven days. Default one day. */
  deduplicationWindowSeconds?: number;
  /** Most push deliveries in flight at once, 1 to 1,000. `null` restores the default of 100. */
  concurrency?: number | null;
  /** Most deliveries started per period. `null` removes the limit. */
  rateLimit?: { count: number; periodSeconds: number } | null;
  /** Keep exhausted messages in the dead-letter list. Default `true`. */
  deadLetter?: boolean;
}

/** Scopes a call to an application and environment. */
export interface QueueScopeOptions {
  /** Application UUID. Defaults to the client's application, `GIGADRIVE_APPLICATION_ID` in a deployment. */
  applicationId?: string;
  /** Environment slug or UUID. Deployed workloads omit it: their credential selects the environment. */
  environment?: string;
}

/** One message on the wire. Exactly one of `json` or `body` is sent. */
export interface QueueMessageInput {
  /** Any JSON value, sent with content type `application/json`. */
  json?: unknown;
  /** A string body, or base64 when {@link encoding} is `base64`. */
  body?: string;
  encoding?: 'utf8' | 'base64';
  contentType?: string;
  /** Headers forwarded with push deliveries. Names under `x-gigadrive-` and transport headers are reserved. */
  headers?: Record<string, string>;
  /** Deliver after this many seconds, up to one year. */
  delaySeconds?: number;
  /** ISO 8601 time to deliver at, up to one year ahead. Wins over {@link delaySeconds}. */
  deliverAt?: string;
  /** Messages with the same key are delivered one at a time, in send order. */
  groupKey?: string;
  /** A repeat of this key within the deduplication window is dropped and returns the first message's id. */
  deduplicationKey?: string;
  /** Deliver to this deployment instead of the environment's current one. */
  deploymentId?: string;
}

/** Outcome of one sent message. */
export type QueueSendResult =
  | {
      messageId: string;
      /** `true` when the deduplication key matched an earlier message, whose id is returned. */
      deduplicated: boolean;
      /** ISO 8601 time the message becomes deliverable. */
      deliverAt: string;
      error?: undefined;
    }
  | {
      messageId: null;
      error: string;
      /** Machine-readable reason, such as `backlog_full`. */
      code: string;
      /** Sending again later may succeed. */
      retryable: boolean;
    };

/** A stored message, as listed, fetched or received. */
export interface QueueMessageRecord {
  id: string;
  state: 'ready' | 'scheduled' | 'waiting' | 'inflight' | 'dead';
  /** UTF-8 text or base64, per {@link encoding}. Listings cut it to a preview; see {@link bodyTruncated}. */
  body: string;
  encoding: 'utf8' | 'base64';
  bodyTruncated: boolean;
  contentType: string;
  headers: Record<string, string>;
  /** Deliveries made so far. */
  attempts: number;
  sizeBytes: number;
  groupKey: string | null;
  deduplicationKey: string | null;
  deploymentId: string | null;
  /** What sent the message, such as `schedule:daily-digest`. `null` for API sends. */
  source: string | null;
  lastError: string | null;
  createdAt: string;
  deliverAt: string;
  expiresAt: string;
  leaseExpiresAt: string | null;
  lastDeliveredAt: string | null;
  deadAt: string | null;
  /** Lease token, present on received messages. Pass it to ack, nack and extend. */
  receipt?: string;
}

/** A recurring send into a queue. */
export interface QueueSchedule {
  id: string;
  name: string;
  /** Five-field cron expression or macro such as `@hourly`. */
  cron: string;
  /** IANA time zone the expression is evaluated in. */
  timezone: string;
  body: string;
  contentType: string;
  headers: Record<string, string>;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastMessageId: string | null;
  lastError: string | null;
  /** `config` for schedules declared in `gigadrive.yaml`, else `api`. */
  source: string;
  createdAt: string;
  updatedAt: string;
}

/** Fields of a schedule. Use `json` for a JSON body or `body` for text. */
export interface QueueScheduleInput {
  cron?: string;
  timezone?: string;
  json?: unknown;
  body?: string;
  contentType?: string;
  headers?: Record<string, string>;
  enabled?: boolean;
}

/** Outcome of a nack. */
export type QueueNackResult = { status: 'retrying'; deliverAt: string } | { status: 'dead' | 'dropped' };

/**
 * Network Queues over REST: create and manage queues and schedules, send,
 * receive and acknowledge messages.
 *
 * For typed sending and consuming, prefer {@link QueuesResource.queue}, which
 * returns a {@link Queue} handle bound to one queue name.
 */
export class QueuesResource extends BaseResource {
  constructor(
    httpClient: HttpClient,
    private readonly defaultApplicationId?: string
  ) {
    super(httpClient);
  }

  /**
   * Returns a typed handle for one queue. Nothing is sent until you call a
   * method on it, and the queue does not need to exist: the first send
   * creates a pull queue with default settings.
   *
   * @typeParam T - The payload type sent and received through this queue.
   * @param name - Queue name, unique in the environment and case-sensitive.
   * @param options - Scope, codec and default send options.
   */
  queue<T = unknown>(name: string, options: QueueOptions<T> = {}): Queue<T> {
    return new Queue<T>(name, () => this, options);
  }

  private base(options: QueueScopeOptions | undefined): string {
    return `/applications/${encodeURIComponent(
      resolveStorageApplicationId(this.defaultApplicationId, options?.applicationId)
    )}/queues`;
  }

  private path(name: string, options: QueueScopeOptions | undefined, suffix = ''): string {
    return `${this.base(options)}/${encodeURIComponent(name)}${suffix}`;
  }

  /** Lists the environment's queues with their live depth. */
  async list(options?: QueueScopeOptions): Promise<{ items: QueueInfo[]; total: number }> {
    return this.httpClient.get(this.base(options), { query: { environment: options?.environment } });
  }

  /** Fetches one queue with its live depth. */
  async get(name: string, options?: QueueScopeOptions): Promise<QueueInfo> {
    return this.httpClient.get(this.path(name, options), { query: { environment: options?.environment } });
  }

  /**
   * Creates a queue. Fails with `queue_exists` when the name is taken; use
   * {@link ensure} for create-or-update.
   */
  async create(name: string, settings: QueueSettings = {}, options?: QueueScopeOptions): Promise<QueueInfo> {
    return this.httpClient.post(this.base(options), { name, environment: options?.environment, ...settings });
  }

  /** Creates the queue, or applies `settings` to the existing one. */
  async ensure(
    name: string,
    settings: QueueSettings = {},
    options?: QueueScopeOptions
  ): Promise<QueueInfo & { created: boolean }> {
    return this.httpClient.put(this.path(name, options), { environment: options?.environment, ...settings });
  }

  /** Changes a queue's settings. Messages already queued keep flowing. */
  async update(name: string, settings: QueueSettings, options?: QueueScopeOptions): Promise<QueueInfo> {
    return this.httpClient.patch(this.path(name, options), { environment: options?.environment, ...settings });
  }

  /** Deletes a queue, its messages and its schedules. */
  async delete(name: string, options?: QueueScopeOptions): Promise<{ purgedMessages: number }> {
    return this.httpClient.delete(this.path(name, options), { query: { environment: options?.environment } });
  }

  /** Stops deliveries. Sends are still accepted and wait until you resume. */
  async pause(name: string, options?: QueueScopeOptions): Promise<QueueInfo> {
    return this.httpClient.post(this.path(name, options, '/pause'), { environment: options?.environment });
  }

  /** Restarts deliveries after {@link pause}. */
  async resume(name: string, options?: QueueScopeOptions): Promise<QueueInfo> {
    return this.httpClient.post(this.path(name, options, '/resume'), { environment: options?.environment });
  }

  /** Deletes every message, or only the dead letters. */
  async purge(
    name: string,
    scope: 'all' | 'dead' = 'all',
    options?: QueueScopeOptions
  ): Promise<{ purgedMessages: number }> {
    return this.httpClient.post(this.path(name, options, '/purge'), { environment: options?.environment, scope });
  }

  /** Moves dead letters back to the queue with fresh attempts: all of them, or the given ids. */
  async redrive(
    name: string,
    messageIds?: string[],
    options?: QueueScopeOptions
  ): Promise<{ redrivenMessages: number }> {
    return this.httpClient.post(this.path(name, options, '/redrive'), {
      environment: options?.environment,
      ...(messageIds ? { messageIds } : {}),
    });
  }

  /**
   * Sends one message.
   *
   * @param autoCreate - Create a pull queue with default settings when the name is new. Default `true`.
   */
  async send(
    name: string,
    message: QueueMessageInput,
    options?: QueueScopeOptions & { autoCreate?: boolean }
  ): Promise<QueueSendResult> {
    return this.httpClient.post(this.path(name, options, '/messages'), {
      environment: options?.environment,
      autoCreate: options?.autoCreate,
      ...message,
    });
  }

  /**
   * Sends up to 100 messages in one request. Results come back in input
   * order; one rejected message does not fail the others.
   */
  async sendBatch(
    name: string,
    messages: QueueMessageInput[],
    options?: QueueScopeOptions & { autoCreate?: boolean }
  ): Promise<QueueSendResult[]> {
    const { results } = await this.httpClient.post<{ results: QueueSendResult[] }>(
      this.path(name, options, '/messages'),
      { environment: options?.environment, autoCreate: options?.autoCreate, messages }
    );
    return results;
  }

  /** Lists messages in one state without leasing them. Bodies are cut to a preview. */
  async listMessages(
    name: string,
    query: { state?: 'ready' | 'scheduled' | 'inflight' | 'dead'; offset?: number; limit?: number } = {},
    options?: QueueScopeOptions
  ): Promise<{ items: QueueMessageRecord[]; total: number }> {
    return this.httpClient.get(this.path(name, options, '/messages'), {
      query: { environment: options?.environment, ...query },
    });
  }

  /** Fetches one message without leasing it. */
  async getMessage(name: string, messageId: string, options?: QueueScopeOptions): Promise<QueueMessageRecord> {
    return this.httpClient.get(this.path(name, options, `/messages/${encodeURIComponent(messageId)}`), {
      query: { environment: options?.environment },
    });
  }

  /** Deletes a message in any state, such as a scheduled send you no longer want. */
  async deleteMessage(name: string, messageId: string, options?: QueueScopeOptions): Promise<{ deleted: boolean }> {
    return this.httpClient.delete(this.path(name, options, `/messages/${encodeURIComponent(messageId)}`), {
      query: { environment: options?.environment },
    });
  }

  /**
   * Leases up to `maxMessages` messages from a pull queue, waiting up to
   * `waitSeconds` (at most 20) for the first one. Each must be acknowledged
   * with its receipt before the lease ends, or it is delivered again.
   */
  async receive(
    name: string,
    request: { maxMessages?: number; waitSeconds?: number; visibilityTimeoutSeconds?: number } = {},
    options?: QueueScopeOptions & { signal?: AbortSignal }
  ): Promise<QueueMessageRecord[]> {
    const { messages } = await this.httpClient.post<{ messages: QueueMessageRecord[] }>(
      this.path(name, options, '/messages/receive'),
      { environment: options?.environment, ...request },
      { signal: options?.signal }
    );
    return messages;
  }

  /** Acknowledges a received message, deleting it. */
  async ack(
    name: string,
    messageId: string,
    receipt: string,
    options?: QueueScopeOptions
  ): Promise<{ acknowledged: boolean }> {
    return this.httpClient.post(this.path(name, options, `/messages/${encodeURIComponent(messageId)}/ack`), {
      environment: options?.environment,
      receipt,
    });
  }

  /**
   * Releases a received message: retry with backoff (or after `delaySeconds`),
   * or dead-letter it now with `deadLetter: true`. `countAttempt: false`
   * reschedules without spending an attempt.
   */
  async nack(
    name: string,
    messageId: string,
    request: { receipt: string; delaySeconds?: number; deadLetter?: boolean; countAttempt?: boolean; error?: string },
    options?: QueueScopeOptions
  ): Promise<QueueNackResult> {
    return this.httpClient.post(this.path(name, options, `/messages/${encodeURIComponent(messageId)}/nack`), {
      environment: options?.environment,
      ...request,
    });
  }

  /** Extends a received message's lease to `visibilityTimeoutSeconds` from now. */
  async extend(
    name: string,
    messageId: string,
    receipt: string,
    visibilityTimeoutSeconds: number,
    options?: QueueScopeOptions
  ): Promise<{ leaseExpiresAt: string }> {
    return this.httpClient.post(this.path(name, options, `/messages/${encodeURIComponent(messageId)}/extend`), {
      environment: options?.environment,
      receipt,
      visibilityTimeoutSeconds,
    });
  }

  /** Lists a queue's schedules. */
  async listSchedules(name: string, options?: QueueScopeOptions): Promise<{ items: QueueSchedule[]; total: number }> {
    return this.httpClient.get(this.path(name, options, '/schedules'), {
      query: { environment: options?.environment },
    });
  }

  /**
   * Creates a schedule that sends a message into the queue on a cron.
   *
   * @example
   * ```ts
   * await client.queues.createSchedule('emails', 'daily-digest', {
   *   cron: '0 8 * * MON-FRI',
   *   timezone: 'Europe/Berlin',
   *   json: { kind: 'digest' },
   * });
   * ```
   */
  async createSchedule(
    name: string,
    schedule: string,
    input: QueueScheduleInput & { cron: string },
    options?: QueueScopeOptions
  ): Promise<QueueSchedule> {
    return this.httpClient.post(this.path(name, options, '/schedules'), {
      environment: options?.environment,
      name: schedule,
      ...input,
    });
  }

  /** Changes a schedule. Its next run is recomputed when the cron or time zone changes. */
  async updateSchedule(
    name: string,
    schedule: string,
    input: QueueScheduleInput,
    options?: QueueScopeOptions
  ): Promise<QueueSchedule> {
    return this.httpClient.patch(this.path(name, options, `/schedules/${encodeURIComponent(schedule)}`), {
      environment: options?.environment,
      ...input,
    });
  }

  /** Deletes a schedule. Messages it already sent stay queued. */
  async deleteSchedule(name: string, schedule: string, options?: QueueScopeOptions): Promise<{ deleted: boolean }> {
    return this.httpClient.delete(this.path(name, options, `/schedules/${encodeURIComponent(schedule)}`), {
      query: { environment: options?.environment },
    });
  }

  /** Sends the schedule's message now, outside its cron. */
  async triggerSchedule(name: string, schedule: string, options?: QueueScopeOptions): Promise<{ messageId: string }> {
    return this.httpClient.post(this.path(name, options, `/schedules/${encodeURIComponent(schedule)}/trigger`), {
      environment: options?.environment,
    });
  }
}

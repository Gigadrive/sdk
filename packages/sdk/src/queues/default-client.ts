import { GigadriveClient } from '../client';
import type { QueuesResource } from '../resources/queues';
import { Queue, type QueueOptions } from './queue';

let defaultClient: GigadriveClient | undefined;

/**
 * The resource behind top-level {@link queue} handles: a zero-config
 * {@link GigadriveClient}, created on first use so that a push handler,
 * which needs no API access, works without credentials.
 *
 * @internal
 */
export const defaultQueuesResource = (): QueuesResource => {
  defaultClient ??= new GigadriveClient();
  return defaultClient.queues;
};

/**
 * Returns a typed handle for a Gigadrive Network queue.
 *
 * Inside a deployment this needs no configuration: the platform injects the
 * credentials and the queue signing secret. Elsewhere, set
 * `GIGADRIVE_CLIENT_ID`, `GIGADRIVE_CLIENT_SECRET` and
 * `GIGADRIVE_APPLICATION_ID`, pass `environment`, or use
 * `client.queues.queue(name)` on a client you configure.
 *
 * @typeParam T - The payload type sent and received through this queue.
 * @param name - Queue name, unique in the environment and case-sensitive.
 *
 * @example
 * ```ts
 * import { queue } from '@gigadrive/sdk';
 *
 * export const emails = queue<{ to: string }>('emails');
 *
 * await emails.send({ to: 'jane@example.com' }, { delay: '10m' });
 *
 * // app/api/queues/emails/route.ts
 * export const POST = emails.handler(async (email) => sendWelcomeEmail(email.to));
 * ```
 */
export function queue<T = unknown>(
  name: string,
  options: QueueOptions<T> & { client?: GigadriveClient } = {}
): Queue<T> {
  const { client, ...queueOptions } = options;
  return new Queue<T>(name, () => client?.queues ?? defaultQueuesResource(), queueOptions);
}

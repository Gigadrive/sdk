import { GigadriveError } from '../errors';
import { durationToSeconds, type QueueDuration } from './encoding';

/**
 * Throw from a queue handler to have the message delivered again later
 * without spending one of its attempts. Use it for "not yet" outcomes, such
 * as waiting on a dependency or backing off a rate-limited API.
 *
 * @example
 * ```ts
 * export const POST = emails.handler(async (email) => {
 *   if (await provider.isThrottled()) throw new RetryLaterError('30s');
 *   await provider.send(email);
 * });
 * ```
 */
export class RetryLaterError extends GigadriveError {
  /** Seconds until the next delivery. */
  readonly delaySeconds: number;

  constructor(delay: QueueDuration, message = 'Message deferred') {
    super(message);
    this.name = 'RetryLaterError';
    this.delaySeconds = durationToSeconds(delay);
  }
}

/**
 * Throw from a queue handler when retrying cannot help, such as a payload
 * that fails validation. The message moves to the dead-letter list straight
 * away (or is dropped when the queue keeps no dead letters), with this
 * error's message recorded as the reason.
 */
export class NonRetryableError extends GigadriveError {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

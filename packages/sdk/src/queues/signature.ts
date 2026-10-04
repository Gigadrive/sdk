import { toArrayBuffer, toHex, utf8Encode } from './encoding';

/** Header carrying the delivery signature: `t=<unix ms>,v1=<hex HMAC-SHA256>`. */
export const QUEUE_SIGNATURE_HEADER = 'x-gigadrive-queue-signature';

/** How far a delivery's signing time may drift from the receiver's clock. */
export const QUEUE_SIGNATURE_TOLERANCE_MS = 5 * 60_000;

/** The environment variable the platform injects with the environment's queue signing secret. */
export const QUEUE_SIGNING_SECRET_ENV = 'GIGADRIVE_QUEUE_SIGNING_SECRET';

/** What a delivery signature covers. */
export interface QueueSignatureInput {
  /** The environment's signing secret, `GIGADRIVE_QUEUE_SIGNING_SECRET` in a deployment. */
  secret: string;
  /** Queue name from `x-gigadrive-queue-name`. */
  queue: string;
  /** Message id from `x-gigadrive-queue-message-id`. */
  messageId: string;
  /** Delivery attempt from `x-gigadrive-queue-attempt`. */
  attempt: number;
  /** The raw request body, exactly as received. */
  body: Uint8Array | string;
}

const hmacSha256Hex = async (secret: string, payload: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(utf8Encode(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return toHex(await crypto.subtle.sign('HMAC', key, toArrayBuffer(utf8Encode(payload))));
};

const signedPayload = async (input: Omit<QueueSignatureInput, 'secret'>, timestamp: number): Promise<string> => {
  const body = typeof input.body === 'string' ? utf8Encode(input.body) : input.body;
  const bodyHash = toHex(await crypto.subtle.digest('SHA-256', toArrayBuffer(body)));
  return `${String(timestamp)}.${input.queue}.${input.messageId}.${String(input.attempt)}.${bodyHash}`;
};

/** Constant-time comparison of two equal-length hex strings. */
const safeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
};

/**
 * Computes the `x-gigadrive-queue-signature` header value for a delivery.
 *
 * Gigadrive Network signs every push delivery this way. Use it to build
 * signed requests when you unit-test a queue handler.
 *
 * @param input - Secret and delivery fields to sign.
 * @param timestamp - Signing time in Unix milliseconds. Defaults to now.
 * @returns The header value, `t=<ms>,v1=<hex>`.
 *
 * @example
 * ```ts
 * const signature = await signQueueDelivery({ secret, queue: 'emails', messageId, attempt: 1, body });
 * await handler(new Request(url, { method: 'POST', body, headers: { 'x-gigadrive-queue-signature': signature, ... } }));
 * ```
 */
export async function signQueueDelivery(input: QueueSignatureInput, timestamp = Date.now()): Promise<string> {
  return `t=${String(timestamp)},v1=${await hmacSha256Hex(input.secret, await signedPayload(input, timestamp))}`;
}

/**
 * Verifies a push delivery's `x-gigadrive-queue-signature` header.
 *
 * Rejects a missing or malformed header, a signature made with another
 * secret or over different fields, and one signed more than five minutes
 * away from `now`. {@link Queue.handler} calls this for you.
 *
 * @param header - The header value, or `null` when absent.
 * @param input - Secret and the delivery fields the signature must cover.
 * @param now - The receiver's clock in Unix milliseconds. Defaults to now.
 * @returns `true` only for a valid, fresh signature.
 */
export async function verifyQueueSignature(
  header: string | null | undefined,
  input: QueueSignatureInput,
  now = Date.now()
): Promise<boolean> {
  if (!header || !input.secret) return false;
  const fields = new Map<string, string>();
  for (const part of header.split(',')) {
    const separator = part.indexOf('=');
    if (separator > 0) fields.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }
  const timestamp = Number(fields.get('t'));
  const signature = fields.get('v1');
  if (!Number.isSafeInteger(timestamp) || !signature || Math.abs(now - timestamp) > QUEUE_SIGNATURE_TOLERANCE_MS) {
    return false;
  }
  const expected = await hmacSha256Hex(input.secret, await signedPayload(input, timestamp));
  return safeEqual(signature.toLowerCase(), expected);
}

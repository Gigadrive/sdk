import { GigadriveError } from '../errors';
import { toArrayBuffer, utf8Encode } from '../queues/encoding';
import type { MicroVmWebhookEvent } from './types';

/** A webhook request whose signature or timestamp did not check out. Answer it with `401`. */
export class MicroVmWebhookVerificationError extends GigadriveError {
  constructor(message: string) {
    super(message);
    this.name = 'MicroVmWebhookVerificationError';
  }
}

/** Input of {@link verifyMicroVmWebhook}. */
export interface VerifyMicroVmWebhookInput {
  /** The raw request body, exactly as received. Parsed and re-serialized JSON does not verify. */
  body: string | Uint8Array;
  /** The request headers: a `Headers` object or a plain record such as Node's `req.headers`. */
  headers: Headers | Record<string, string | string[] | undefined>;
  /** The webhook's signing secret (`whsec_...`). */
  secret: string;
  /** Largest accepted gap between the request's timestamp and now, in seconds. Default 300. */
  toleranceSeconds?: number;
}

const decoder = new TextDecoder();

const header = (headers: VerifyMicroVmWebhookInput['headers'], name: string): string | undefined => {
  if (typeof Headers !== 'undefined' && headers instanceof Headers) return headers.get(name) ?? undefined;
  const record = headers as Record<string, string | string[] | undefined>;
  const value = record[name] ?? Object.entries(record).find(([key]) => key.toLowerCase() === name)?.[1];
  return Array.isArray(value) ? value[0] : value;
};

const fromBase64 = (text: string): Uint8Array | undefined => {
  try {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return undefined;
  }
};

/** Compares in time independent of where the inputs differ. */
const equalBytes = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
};

/**
 * Verifies a microVM webhook request (Standard Webhooks signing) and returns
 * its event. Checks the `webhook-signature` against the secret and rejects a
 * `webhook-timestamp` more than `toleranceSeconds` from now, so an old request
 * cannot be replayed. Runs anywhere Web Crypto exists: Node.js 18+, Bun, Deno,
 * edge runtimes and browsers.
 *
 * Events can arrive more than once and out of order: deduplicate on the
 * `webhook-id` header and order by `timestamp`.
 *
 * @throws {@link MicroVmWebhookVerificationError} when a header is missing, the
 * timestamp is out of range, or no signature matches.
 *
 * @example
 * ```ts
 * export async function POST(request: Request) {
 *   const event = await verifyMicroVmWebhook({
 *     body: await request.text(),
 *     headers: request.headers,
 *     secret: process.env.MICROVM_WEBHOOK_SECRET!,
 *   });
 *   if (event.type === 'microvm.failed') await alert(event.data.microvmId);
 *   return new Response(null, { status: 204 });
 * }
 * ```
 */
export async function verifyMicroVmWebhook(input: VerifyMicroVmWebhookInput): Promise<MicroVmWebhookEvent> {
  const id = header(input.headers, 'webhook-id');
  const timestamp = header(input.headers, 'webhook-timestamp');
  const signatures = header(input.headers, 'webhook-signature');
  if (!id || !timestamp || !signatures) {
    throw new MicroVmWebhookVerificationError(
      'The request is missing the webhook-id, webhook-timestamp or webhook-signature header.'
    );
  }
  const seconds = Number(timestamp);
  const tolerance = input.toleranceSeconds ?? 300;
  if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - seconds) > tolerance) {
    throw new MicroVmWebhookVerificationError('The webhook timestamp is missing or too far from the current time.');
  }
  const key = fromBase64(input.secret.replace(/^whsec_/, ''));
  if (!key || key.length === 0) throw new MicroVmWebhookVerificationError('The signing secret is not a whsec_ secret.');

  const body = typeof input.body === 'string' ? input.body : decoder.decode(input.body);
  const hmacKey = await crypto.subtle.importKey('raw', toArrayBuffer(key), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const expected = new Uint8Array(
    await crypto.subtle.sign('HMAC', hmacKey, toArrayBuffer(utf8Encode(`${id}.${timestamp}.${body}`)))
  );
  const matches = signatures.split(' ').some((entry) => {
    const [version, signature] = entry.split(',', 2);
    const received = version === 'v1' && signature ? fromBase64(signature) : undefined;
    return received !== undefined && equalBytes(received, expected);
  });
  if (!matches) throw new MicroVmWebhookVerificationError('No webhook signature matches the signing secret.');

  try {
    return JSON.parse(body) as MicroVmWebhookEvent;
  } catch {
    throw new MicroVmWebhookVerificationError('The webhook body is not JSON.');
  }
}

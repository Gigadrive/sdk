/**
 * Byte, base64 and duration helpers shared by the queue client, the push
 * handler and the Workflow adapter. Runtime-neutral: Web APIs only.
 *
 * @internal
 */

const DURATION_PATTERN = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)$/;
const UNIT_SECONDS = { ms: 0.001, s: 1, m: 60, h: 3_600, d: 86_400 } as const;

/**
 * A duration as seconds, or a string such as `'500ms'`, `'30s'`, `'10m'`,
 * `'12h'` or `'7d'`.
 */
export type QueueDuration = number | `${number}${'ms' | 's' | 'm' | 'h' | 'd'}`;

/**
 * Converts a {@link QueueDuration} to whole seconds, rounding up so a
 * sub-second delay never becomes "now".
 *
 * @throws {Error} When the value is negative, not finite, or not a recognised duration string.
 */
export const durationToSeconds = (value: QueueDuration): number => {
  let seconds: number;
  if (typeof value === 'number') {
    seconds = value;
  } else {
    const match = DURATION_PATTERN.exec(value.trim());
    if (!match) throw new Error(`Invalid duration "${value}". Use seconds or a string such as 30s, 10m, 12h or 7d.`);
    seconds = Number(match[1]) * UNIT_SECONDS[match[2] as keyof typeof UNIT_SECONDS];
  }
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error(`Invalid duration "${String(value)}"`);
  return Math.ceil(seconds);
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const utf8Encode = (value: string): Uint8Array => textEncoder.encode(value);
export const utf8Decode = (bytes: Uint8Array): string => textDecoder.decode(bytes);

export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
};

export const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

export const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');

/** Copies bytes into a fresh `ArrayBuffer`, which Web Crypto and `fetch` accept everywhere. */
export const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
};

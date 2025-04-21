import crypto from 'crypto';

/**
 * Hashes a string using SHA-256
 * @param value The string to hash
 * @returns The SHA-256 hash of the input string
 */
// eslint-disable-next-line @typescript-eslint/require-await
export const sha256 = async (value: string) => crypto.createHash('sha256').update(value).digest('hex');

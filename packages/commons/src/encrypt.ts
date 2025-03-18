import crypto from 'crypto';
import { TextDecoder, TextEncoder } from 'util';

/**
 * Encrypts a string using another string as a key via AES-GCM
 * @param text - The string to encrypt
 * @param key - The encryption key
 * @returns The encrypted string as base64
 */
export async function encrypt(text: string, key: string): Promise<string> {
  if (!text || !key) {
    throw new Error('Both text and key are required');
  }

  // Convert text to bytes
  const textBytes = new TextEncoder().encode(text);

  // Generate a key using SHA-256 hash of the provided key
  const keyBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));

  // Import the key for AES
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
  ]);

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the data
  const encryptedBytes = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, textBytes);

  // Combine IV and encrypted data
  const result = new Uint8Array(iv.length + encryptedBytes.byteLength);
  result.set(iv);
  result.set(new Uint8Array(encryptedBytes), iv.length);

  // Convert to base64
  return btoa(String.fromCharCode(...result));
}

/**
 * Decrypts a string that was encrypted using the encrypt function
 * @param encryptedText - The base64 encrypted string
 * @param key - The decryption key (must be same as encryption key)
 * @returns The decrypted string
 */
export async function decrypt(encryptedText: string, key: string): Promise<string> {
  if (!encryptedText || !key) {
    throw new Error('Both encrypted text and key are required');
  }

  try {
    // Convert base64 to bytes
    const encryptedBytes = new Uint8Array(
      atob(encryptedText)
        .split('')
        .map((c) => c.charCodeAt(0))
    );

    // Extract IV and encrypted data
    const iv = encryptedBytes.slice(0, 12);
    const data = encryptedBytes.slice(12);

    // Generate key using SHA-256 hash of the provided key
    const keyBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));

    // Import the key for AES
    const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM', length: 256 }, false, [
      'decrypt',
    ]);

    // Decrypt the data
    const decryptedBytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, data);

    // Convert back to string
    return new TextDecoder().decode(decryptedBytes);
  } catch (error) {
    throw new Error('Failed to decrypt: Invalid input or key');
  }
}

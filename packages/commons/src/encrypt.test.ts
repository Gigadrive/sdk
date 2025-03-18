import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from './encrypt';

describe('Encryption and Decryption', () => {
  const testKey = 'myTestKey123';
  const testText = 'Hello, World!';

  it('should successfully encrypt and decrypt text', async () => {
    const encrypted = await encrypt(testText, testKey);
    const decrypted = await decrypt(encrypted, testKey);

    expect(decrypted).toBe(testText);
  });

  it('should generate different ciphertexts for the same input', async () => {
    const encrypted1 = await encrypt(testText, testKey);
    const encrypted2 = await encrypt(testText, testKey);

    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should handle empty strings', async () => {
    const emptyText = '';
    await expect(encrypt(emptyText, testKey)).rejects.toThrow();
    await expect(decrypt(emptyText, testKey)).rejects.toThrow();
  });

  it('should handle empty keys', async () => {
    const emptyKey = '';
    await expect(encrypt(testText, emptyKey)).rejects.toThrow();
    await expect(decrypt(await encrypt(testText, testKey), emptyKey)).rejects.toThrow();
  });

  it('should handle special characters in input', async () => {
    const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?`~™®©℗℠';
    const encrypted = await encrypt(specialChars, testKey);
    const decrypted = await decrypt(encrypted, testKey);

    expect(decrypted).toBe(specialChars);
  });

  it('should handle unicode characters', async () => {
    const unicodeText = '你好，世界！🌍✨';
    const encrypted = await encrypt(unicodeText, testKey);
    const decrypted = await decrypt(encrypted, testKey);

    expect(decrypted).toBe(unicodeText);
  });

  it('should handle long text', async () => {
    const longText = 'a'.repeat(1000);
    const encrypted = await encrypt(longText, testKey);
    const decrypted = await decrypt(encrypted, testKey);

    expect(decrypted).toBe(longText);
  });

  it('should fail decryption with wrong key', async () => {
    const wrongKey = 'wrongKey123';
    const encrypted = await encrypt(testText, testKey);

    await expect(decrypt(encrypted, wrongKey)).rejects.toThrow();
  });

  it('should fail decryption with corrupted ciphertext', async () => {
    const encrypted = await encrypt(testText, testKey);
    const corrupted = encrypted.slice(0, -5) + 'XXXXX'; // Corrupt the last 5 characters

    await expect(decrypt(corrupted, testKey)).rejects.toThrow();
  });

  it('should handle different key lengths', async () => {
    const shortKey = 'a';
    const longKey = 'a'.repeat(100);

    const encrypted1 = await encrypt(testText, shortKey);
    const decrypted1 = await decrypt(encrypted1, shortKey);
    expect(decrypted1).toBe(testText);

    const encrypted2 = await encrypt(testText, longKey);
    const decrypted2 = await decrypt(encrypted2, longKey);
    expect(decrypted2).toBe(testText);
  });

  describe('Performance', () => {
    it('should encrypt and decrypt large text within reasonable time', async () => {
      const largeText = 'a'.repeat(100000);
      const start = performance.now();

      const encrypted = await encrypt(largeText, testKey);
      const decrypted = await decrypt(encrypted, testKey);

      const end = performance.now();
      const duration = end - start;

      expect(decrypted).toBe(largeText);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined inputs', async () => {
      // @ts-expect-error Testing invalid input
      await expect(encrypt(null, testKey)).rejects.toThrow();
      // @ts-expect-error Testing invalid input
      await expect(encrypt(undefined, testKey)).rejects.toThrow();
      // @ts-expect-error Testing invalid input
      await expect(encrypt(testText, null)).rejects.toThrow();
      // @ts-expect-error Testing invalid input
      await expect(encrypt(testText, undefined)).rejects.toThrow();
    });
  });
});

import { describe, expect, it } from 'vitest';
import { computeChecksums } from './checksum';

const HELLO = new TextEncoder().encode('hello');

describe('computeChecksums', () => {
  it('computes the SHA-256 of a buffer', async () => {
    const { sha256 } = await computeChecksums(HELLO);
    expect(sha256).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('computes optional SHA-1 and MD5 on request', async () => {
    const { sha256, sha1, md5 } = await computeChecksums(HELLO, { sha1: true, md5: true });
    expect(sha256).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    expect(sha1).toBe('aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d');
    expect(md5).toBe('5d41402abc4b2a76b9719d911017c592');
  });

  it('omits optional checksums when not requested', async () => {
    const result = await computeChecksums(HELLO);
    expect(result.sha1).toBeUndefined();
    expect(result.md5).toBeUndefined();
  });
});

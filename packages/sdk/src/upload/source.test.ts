import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveUploadSource } from './source';

const HELLO_SHA256 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
const noopStream = { on: () => undefined };

describe('resolveUploadSource', () => {
  it('resolves in-memory data: size, inferred content type, computed SHA-256', async () => {
    const resolved = await resolveUploadSource({ key: 'docs/file.txt', data: new TextEncoder().encode('hello') });
    expect(resolved.size).toBe(5);
    expect(resolved.contentType).toBe('text/plain');
    expect(resolved.checksums.sha256).toBe(HELLO_SHA256);
    expect(resolved.requiresFiniteChunkSize).toBe(false);
  });

  it('uses a provided checksum instead of computing one', async () => {
    const resolved = await resolveUploadSource({
      key: 'x.bin',
      data: new Uint8Array([1, 2, 3]),
      checksumSha256: 'deadbeef',
    });
    expect(resolved.checksums.sha256).toBe('deadbeef');
  });

  it('skips hashing when hash:false', async () => {
    const resolved = await resolveUploadSource({ key: 'x.bin', data: new Uint8Array([1, 2, 3]) }, { hash: false });
    expect(resolved.checksums.sha256).toBe('');
  });

  it('requires contentLength for streams', async () => {
    await expect(resolveUploadSource({ key: 'x', stream: noopStream })).rejects.toThrow(/contentLength/);
  });

  it('requires a checksum for streams when hashing', async () => {
    await expect(resolveUploadSource({ key: 'x', stream: noopStream, contentLength: 10 })).rejects.toThrow(
      /checksumSha256/
    );
  });

  it('accepts a stream with contentLength + checksum and requires a finite chunk size', async () => {
    const resolved = await resolveUploadSource({
      key: 'x',
      stream: noopStream,
      contentLength: 10,
      checksumSha256: 'a'.repeat(64),
    });
    expect(resolved.size).toBe(10);
    expect(resolved.tusFile).toBe(noopStream);
    expect(resolved.requiresFiniteChunkSize).toBe(true);
  });

  it('throws when no source is provided', async () => {
    await expect(resolveUploadSource({ key: 'x' })).rejects.toThrow(/No upload source/);
  });

  it('rejects ambiguous input with more than one source', async () => {
    await expect(resolveUploadSource({ key: 'x', data: new Uint8Array([1]), path: '/tmp/whatever' })).rejects.toThrow(
      /only one upload source/i
    );
  });

  it('honors a pre-supplied SHA-1 while computing the SHA-256', async () => {
    const resolved = await resolveUploadSource({
      key: 'x.txt',
      data: new TextEncoder().encode('hello'),
      checksumSha1: 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d',
    });
    expect(resolved.checksums.sha256).toBe(HELLO_SHA256);
    expect(resolved.checksums.sha1).toBe('aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d');
  });

  it('resolves a Node file path (size, content type, streamed SHA-256, finite chunk)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gigadrive-sdk-'));
    const path = join(dir, 'hello.txt');
    writeFileSync(path, 'hello');
    let resolved;
    try {
      resolved = await resolveUploadSource({ key: 'hello.txt', path });
      expect(resolved.size).toBe(5);
      expect(resolved.contentType).toBe('text/plain');
      expect(resolved.checksums.sha256).toBe(HELLO_SHA256);
      expect(resolved.requiresFiniteChunkSize).toBe(true);
    } finally {
      // The resolved tusFile is an unread fs.ReadStream; close it before deleting
      // the temp file so its lazy open does not race with cleanup.
      const stream = resolved?.tusFile as
        { on?: (e: string, cb: () => void) => void; destroy?: () => void } | undefined;
      stream?.on?.('error', () => undefined);
      stream?.destroy?.();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

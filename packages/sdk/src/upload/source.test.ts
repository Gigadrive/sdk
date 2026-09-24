import { Buffer } from 'node:buffer';
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
    expect(Buffer.isBuffer(resolved.tusFile)).toBe(true);
    expect(Buffer.from(resolved.tusFile as Uint8Array).toString('utf8')).toBe('hello');
  });

  it('converts ArrayBuffer data to a Node Buffer for tus-js-client', async () => {
    const data = Uint8Array.from([1, 2, 3]).buffer;
    const resolved = await resolveUploadSource({ key: 'data.bin', data });

    expect(Buffer.isBuffer(resolved.tusFile)).toBe(true);
    expect(Array.from(resolved.tusFile as Uint8Array)).toEqual([1, 2, 3]);
  });

  it('preserves Buffer inputs in Node', async () => {
    const data = Buffer.from('hello');
    const resolved = await resolveUploadSource({ key: 'hello.txt', data });

    expect(resolved.tusFile).toBe(data);
  });

  it('converts Blob data to a Node Buffer for tus-js-client', async () => {
    const resolved = await resolveUploadSource({ key: 'hello.txt', data: new Blob(['hello']) });

    expect(Buffer.isBuffer(resolved.tusFile)).toBe(true);
    expect(Buffer.from(resolved.tusFile as Uint8Array).toString('utf8')).toBe('hello');
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

  describe('empty inputs', () => {
    const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    it.each([
      ['Buffer', Buffer.alloc(0)],
      ['Uint8Array', new Uint8Array(0)],
      ['ArrayBuffer', new ArrayBuffer(0)],
      ['Blob', new Blob([])],
    ])('resolves an empty %s to size 0 and the empty digest', async (_name, data) => {
      const resolved = await resolveUploadSource({ key: '.gitkeep', data });
      expect(resolved.size).toBe(0);
      expect(resolved.checksums.sha256).toBe(EMPTY_SHA256);
    });

    it('resolves an empty file path to size 0 and the empty digest, and releases its stream', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'gigadrive-sdk-'));
      const path = join(dir, '__init__.py');
      writeFileSync(path, '');
      try {
        const resolved = await resolveUploadSource({ key: '__init__.py', path });
        expect(resolved.size).toBe(0);
        expect(resolved.checksums.sha256).toBe(EMPTY_SHA256);
        resolved.release();
        expect((resolved.tusFile as { destroyed?: boolean }).destroyed).toBe(true);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('treats a stream contentLength of 0 as known and fills in the empty digest', async () => {
      const resolved = await resolveUploadSource({ key: '.gitkeep', stream: noopStream, contentLength: 0 });
      expect(resolved.size).toBe(0);
      expect(resolved.checksums.sha256).toBe(EMPTY_SHA256);
    });

    it('keeps a caller-supplied digest for an empty stream', async () => {
      const resolved = await resolveUploadSource({
        key: '.gitkeep',
        stream: noopStream,
        contentLength: 0,
        checksumSha256: 'a'.repeat(64),
      });
      expect(resolved.checksums.sha256).toBe('a'.repeat(64));
    });
  });
});

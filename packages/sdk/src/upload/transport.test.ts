import { describe, expect, it, vi } from 'vitest';
import { UploadError, UploadSessionExpiredError } from '../errors';
import type { ResolvedUploadSource } from './source';
import {
  DEFAULT_STREAM_CHUNK_SIZE,
  createAbortError,
  runResolvedUpload,
  toUploadError,
  tusUploadTransport,
  type TusUploadParams,
} from './transport';

const resolved = (over: Partial<ResolvedUploadSource> = {}): ResolvedUploadSource => ({
  tusFile: new Uint8Array([1, 2, 3]),
  size: 3,
  contentType: 'application/octet-stream',
  checksums: { sha256: 'x' },
  requiresFiniteChunkSize: false,
  ...over,
});

describe('createAbortError', () => {
  it('uses the AbortError name', () => {
    expect(createAbortError().name).toBe('AbortError');
  });
});

describe('toUploadError', () => {
  it('rethrows an AbortError unchanged', () => {
    const abort = createAbortError();
    let thrown: unknown;
    try {
      toUploadError(abort);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBe(abort);
  });

  it('maps 401/403/410 transport statuses to UploadSessionExpiredError', () => {
    for (const status of [401, 403, 410]) {
      const error = { originalResponse: { getStatus: () => status } };
      expect(() => toUploadError(error)).toThrow(UploadSessionExpiredError);
    }
  });

  it('wraps other errors in UploadError, preserving the cause', () => {
    const cause = new Error('boom');
    let thrown: unknown;
    try {
      toUploadError(cause);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(UploadError);
    expect((thrown as UploadError).cause).toBe(cause);
  });
});

describe('runResolvedUpload', () => {
  it('passes upload params and a default chunk size for finite-chunk sources', async () => {
    const transport = vi.fn<(params: TusUploadParams) => Promise<void>>().mockResolvedValue(undefined);
    await runResolvedUpload(transport, 'https://up', resolved({ requiresFiniteChunkSize: true }));
    const params = transport.mock.calls[0]![0];
    expect(params.uploadUrl).toBe('https://up');
    expect(params.uploadSize).toBe(3);
    expect(params.headers).toEqual({ 'Tus-Resumable': '1.0.0' });
    expect(params.chunkSize).toBe(DEFAULT_STREAM_CHUNK_SIZE);
  });

  it('leaves the chunk size undefined for in-memory sources', async () => {
    const transport = vi.fn<(params: TusUploadParams) => Promise<void>>().mockResolvedValue(undefined);
    await runResolvedUpload(transport, 'https://up', resolved());
    expect(transport.mock.calls[0]![0].chunkSize).toBeUndefined();
  });

  it('honors an explicit chunk size', async () => {
    const transport = vi.fn<(params: TusUploadParams) => Promise<void>>().mockResolvedValue(undefined);
    await runResolvedUpload(transport, 'https://up', resolved({ requiresFiniteChunkSize: true }), { chunkSize: 1024 });
    expect(transport.mock.calls[0]![0].chunkSize).toBe(1024);
  });
});

describe('tusUploadTransport', () => {
  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      tusUploadTransport({
        data: new Uint8Array([1]),
        uploadUrl: 'https://up',
        uploadSize: 1,
        headers: {},
        signal: controller.signal,
      })
    ).rejects.toThrow(/aborted/i);
  });
});

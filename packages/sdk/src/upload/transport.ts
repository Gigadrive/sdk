/**
 * Thin, injectable wrapper around `tus-js-client` that performs the resumable
 * byte upload. Isolated here so the upload flow can be unit-tested with a fake
 * transport (no real network I/O) and so abort/resume behaviour lives in one
 * place.
 *
 * @internal
 */

import * as tus from 'tus-js-client';
import { UploadError, UploadSessionExpiredError } from '../errors';
import type { ResolvedUploadSource, TusFile } from './source';

/** Default chunk size for streamed/file-path uploads, which require a finite chunk size. */
export const DEFAULT_STREAM_CHUNK_SIZE = 50 * 1024 * 1024;

/** A persistence backend for resumable upload fingerprints (matches tus-js-client's `UrlStorage`). */
export interface UploadUrlStorage {
  findAllUploads(): Promise<unknown[]>;
  findUploadsByFingerprint(fingerprint: string): Promise<unknown[]>;
  removeUpload(urlStorageKey: string): Promise<void>;
  addUpload(fingerprint: string, upload: unknown): Promise<string>;
}

/** Parameters for a single byte upload. */
export interface TusUploadParams {
  /** The file/data passed to tus-js-client. */
  data: TusFile;
  /** Signed upload URL (already includes the short-lived upload token). */
  uploadUrl: string;
  /** Total upload size in bytes. */
  uploadSize: number;
  /** Headers to send with each request (must include `Tus-Resumable`). */
  headers: Record<string, string>;
  /** Maximum chunk size in bytes. Required for streamed inputs. */
  chunkSize?: number;
  /** Retry backoff in milliseconds. `null`/`[]` disables retries. */
  retryDelays?: number[] | null;
  /** Progress callback. */
  onProgress?: (bytesSent: number, bytesTotal: number) => void;
  /** Abort signal to cancel the upload. */
  signal?: AbortSignal;
  /** Persist a resumable fingerprint so the upload can resume later. */
  resume?: boolean;
  /** Custom storage for resumable fingerprints (defaults to the tus-js-client default for the runtime). */
  urlStorage?: UploadUrlStorage;
}

/** Performs a single resumable byte upload. Resolves on success, rejects on error/abort. */
export type UploadTransport = (params: TusUploadParams) => Promise<void>;

const DEFAULT_RETRY_DELAYS = [0, 1000, 3000, 5000];

/** An `AbortError`-named error, consistent with the Fetch/DOM cancellation convention. */
export const createAbortError = (): Error => {
  const error = new Error('The upload was aborted.');
  error.name = 'AbortError';
  return error;
};

/** The default upload transport, backed by `tus-js-client`. */
export const tusUploadTransport: UploadTransport = (params) =>
  new Promise<void>((resolve, reject) => {
    if (params.signal?.aborted) {
      reject(createAbortError());
      return;
    }

    let settled = false;
    const cleanup = () => {
      if (params.signal) params.signal.removeEventListener('abort', onAbort);
    };
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    const upload = new tus.Upload(params.data as tus.Upload['file'], {
      uploadUrl: params.uploadUrl,
      uploadSize: params.uploadSize,
      headers: params.headers,
      chunkSize: params.chunkSize ?? Infinity,
      retryDelays: params.retryDelays === undefined ? DEFAULT_RETRY_DELAYS : params.retryDelays,
      storeFingerprintForResuming: params.resume ?? false,
      removeFingerprintOnSuccess: true,
      ...(params.urlStorage ? { urlStorage: params.urlStorage as never } : {}),
      onProgress: params.onProgress ?? null,
      onError: (error) => finish(() => reject(error)),
      onSuccess: () => finish(() => resolve()),
    });

    const onAbort = () => {
      void upload.abort();
      finish(() => reject(createAbortError()));
    };
    // `once` ensures the listener detaches after firing, even if `finish` (and
    // thus `cleanup`) never runs because the upload hangs without settling.
    if (params.signal) params.signal.addEventListener('abort', onAbort, { once: true });

    upload.start();
  });

/** Options shared by the high-level upload entry points. */
export interface RunUploadOptions {
  /** Maximum chunk size in bytes. */
  chunkSize?: number;
  /** Retry backoff in milliseconds. `null`/`[]` disables retries. */
  retryDelays?: number[] | null;
  /** Progress callback. */
  onProgress?: (bytesSent: number, bytesTotal: number) => void;
  /** Abort signal to cancel the upload. */
  signal?: AbortSignal;
  /** Persist a resumable fingerprint so the upload can resume later. */
  resume?: boolean;
  /** Custom storage for resumable fingerprints. */
  urlStorage?: UploadUrlStorage;
}

/** Run a resolved upload through the given transport, applying sensible chunk-size defaults. */
export const runResolvedUpload = (
  transport: UploadTransport,
  uploadUrl: string,
  resolved: ResolvedUploadSource,
  options: RunUploadOptions = {},
  headers: Record<string, string> = { 'Tus-Resumable': '1.0.0' }
): Promise<void> =>
  transport({
    data: resolved.tusFile,
    uploadUrl,
    uploadSize: resolved.size,
    headers,
    chunkSize: options.chunkSize ?? (resolved.requiresFiniteChunkSize ? DEFAULT_STREAM_CHUNK_SIZE : undefined),
    retryDelays: options.retryDelays,
    onProgress: options.onProgress,
    signal: options.signal,
    resume: options.resume,
    urlStorage: options.urlStorage,
  });

const tusStatus = (error: unknown): number | undefined => {
  const response = (error as tus.DetailedError | undefined)?.originalResponse;
  return response ? response.getStatus() : undefined;
};

/**
 * Normalise a transport-layer error into an SDK error. Aborts are re-thrown
 * as-is; auth/expiry statuses become {@link UploadSessionExpiredError}; anything
 * else becomes a generic {@link UploadError}.
 */
export const toUploadError = (error: unknown): never => {
  if (error instanceof Error && error.name === 'AbortError') throw error;
  const status = tusStatus(error);
  if (status === 401 || status === 403 || status === 410) {
    throw new UploadSessionExpiredError(undefined, error);
  }
  throw new UploadError(error instanceof Error ? error.message : 'The upload failed.', error);
};

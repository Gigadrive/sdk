import { UploadError } from '../errors';
import type { HttpClient } from '../http-client';
import { resolveUploadSource, type NodeReadableLike, type UploadData } from '../upload/source';
import {
  runResolvedUpload,
  toUploadError,
  tusUploadTransport,
  type UploadTransport,
  type UploadUrlStorage,
} from '../upload/transport';
import { StorageBucketsResource } from './storage-buckets';
import { StorageObjectsResource, type StorageObject } from './storage-objects';
import { StorageUploadSessionsResource, type StorageUploadSession } from './storage-upload-sessions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options controlling whether and how to wait for an upload to finalize server-side. */
export interface WaitForCompletionOptions {
  /** Maximum time to wait in milliseconds. Default: 60000. */
  timeoutMs?: number;
  /** How often to poll the session state, in milliseconds. Default: 1000. */
  pollIntervalMs?: number;
}

/** Input for the high-level {@link ApplicationStorageResource.upload | upload()} method. */
export interface UploadFileInput {
  /** The application ID (UUID). */
  applicationId: string;
  /** The target bucket ID (UUID). */
  bucketId: string;
  /** The object key/path in the bucket (e.g. `"images/logo.png"`). */
  key: string;
  /** In-memory data (browser `File`/`Blob`, Node `Buffer`, `Uint8Array`, `ArrayBuffer`). */
  data?: UploadData;
  /** A filesystem path to upload from (Node.js only). Size, checksum, and content type are derived automatically. */
  path?: string;
  /** A readable stream to upload from (Node.js only). Requires `contentLength` and `checksumSha256`. */
  stream?: NodeReadableLike;
  /** MIME content type. Inferred from `key` when omitted. */
  contentType?: string;
  /** Byte size. Required for `stream`; computed otherwise. */
  contentLength?: number;
  /** Pre-computed SHA-256 (skips hashing). Required for `stream`. */
  checksumSha256?: string;
  /** Also send a SHA-1 checksum. */
  checksumSha1?: string;
  /** Also send an MD5 checksum (Node.js only unless provided). */
  checksumMd5?: string;
  /** Maximum chunk size in bytes (for very large files / streams). */
  chunkSize?: number;
  /** Retry backoff in milliseconds; `null`/`[]` disables retries. */
  retryDelays?: number[] | null;
  /** Progress callback invoked during the byte upload. */
  onProgress?: (bytesSent: number, bytesTotal: number) => void;
  /** Abort signal to cancel the upload. */
  signal?: AbortSignal;
  /** Persist a resumable fingerprint so the upload can be resumed later. */
  resume?: boolean;
  /** Custom storage backend for resumable fingerprints. */
  urlStorage?: UploadUrlStorage;
  /** Wait until the object is finalized server-side before resolving. Pass options to tune polling. */
  waitForCompletion?: boolean | WaitForCompletionOptions;
}

/** Result of a successful upload. */
export interface UploadFileResult {
  /** The upload session. When `waitForCompletion` was set, `state` is `"completed"`. */
  session: StorageUploadSession;
  /** The public/CDN URL of the uploaded object. */
  url: string;
  /** The finalized storage object — present only when `waitForCompletion` was set. */
  object?: StorageObject;
}

/** Options for {@link ApplicationStorageResource.uploadBatch | uploadBatch()}. */
export interface UploadBatchOptions {
  /** Maximum number of concurrent uploads. Default: 4. */
  concurrency?: number;
  /** Called after each file settles, with the number completed and the total. */
  onProgress?: (completed: number, total: number) => void;
}

/** The outcome of one file within a batch upload. Errors are isolated per file. */
export interface UploadBatchItemResult {
  /** The input that produced this result. */
  input: UploadFileInput;
  /** The successful result, if the upload succeeded. */
  result?: UploadFileResult;
  /** The error, if this upload failed. */
  error?: unknown;
}

// ---------------------------------------------------------------------------
// Resource
// ---------------------------------------------------------------------------

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Namespace for all storage operations on an application: bucket management,
 * object listing/access, low-level upload sessions, and the high-level
 * {@link upload} / {@link uploadBatch} helpers.
 *
 * Accessed via `client.applications.storage`.
 *
 * @example
 * ```ts
 * // High-level upload (Node.js, from a path — checksum/size/content-type inferred)
 * const { url } = await client.applications.storage.upload({
 *   applicationId: 'app-id',
 *   bucketId: 'bucket-id',
 *   key: 'photos/cat.jpg',
 *   path: './cat.jpg',
 * });
 *
 * // Browser upload from a file input, with progress and abort
 * const controller = new AbortController();
 * const { url } = await client.applications.storage.upload({
 *   applicationId: 'app-id',
 *   bucketId: 'bucket-id',
 *   key: `uploads/${file.name}`,
 *   data: file,
 *   onProgress: (sent, total) => console.log(`${Math.round((sent / total) * 100)}%`),
 *   signal: controller.signal,
 * });
 * ```
 */
export class ApplicationStorageResource {
  /** Create, list, get, and delete storage buckets. */
  readonly buckets: StorageBucketsResource;
  /** List, get, delete objects, and generate access URLs. */
  readonly objects: StorageObjectsResource;
  /** Low-level upload sessions and direct-to-URL byte uploads. */
  readonly uploadSessions: StorageUploadSessionsResource;

  private readonly transport: UploadTransport;

  constructor(httpClient: HttpClient, transport: UploadTransport = tusUploadTransport) {
    this.transport = transport;
    this.buckets = new StorageBucketsResource(httpClient);
    this.objects = new StorageObjectsResource(httpClient);
    this.uploadSessions = new StorageUploadSessionsResource(httpClient, transport);
  }

  /**
   * Upload a file to a storage bucket. Handles the full flow: computes the
   * required SHA-256 checksum, creates an upload session, uploads the bytes with
   * automatic retries (and optional progress/abort/resume), and returns the
   * public URL.
   *
   * Accepts browser `File`/`Blob`, Node `Buffer`/`Uint8Array`/`ArrayBuffer`, a
   * Node filesystem `path`, or a Node readable `stream` (with `contentLength`
   * and `checksumSha256`). The content type is inferred from `key` when omitted.
   *
   * @param input - What and where to upload, plus optional transfer options.
   * @returns The upload session and public object URL (and the finalized object when `waitForCompletion` is set).
   * @throws {@link UploadError} if the byte upload fails.
   * @throws {@link UploadSessionExpiredError} if the session expires mid-upload.
   *
   * @example
   * ```ts
   * const { session, url, object } = await client.applications.storage.upload({
   *   applicationId, bucketId, key: 'reports/q1.pdf', path: './q1.pdf',
   *   waitForCompletion: true,
   * });
   * console.log(object?.contentLength, 'bytes available at', url);
   * ```
   */
  async upload(input: UploadFileInput): Promise<UploadFileResult> {
    const resolved = await resolveUploadSource({
      key: input.key,
      data: input.data,
      path: input.path,
      stream: input.stream,
      contentType: input.contentType,
      contentLength: input.contentLength,
      checksumSha256: input.checksumSha256,
      checksumSha1: input.checksumSha1,
      checksumMd5: input.checksumMd5,
    });

    const { session, upload } = await this.uploadSessions.create(input.applicationId, input.bucketId, {
      key: input.key,
      contentLength: resolved.size,
      checksumSha256: resolved.checksums.sha256,
      contentType: resolved.contentType,
      checksumSha1: resolved.checksums.sha1,
      checksumMd5: resolved.checksums.md5,
    });

    await runResolvedUpload(
      this.transport,
      upload.url,
      resolved,
      {
        chunkSize: input.chunkSize,
        retryDelays: input.retryDelays,
        onProgress: input.onProgress,
        signal: input.signal,
        resume: input.resume,
        urlStorage: input.urlStorage,
      },
      // Forward any required headers the API issued with the session.
      { 'Tus-Resumable': '1.0.0', ...upload.headers }
    ).catch(toUploadError);

    if (input.waitForCompletion) {
      const options = typeof input.waitForCompletion === 'object' ? input.waitForCompletion : undefined;
      const completed = await this.waitForCompletion(input.applicationId, input.bucketId, session.id, options);
      const object = (await this.objects.getByKey(input.applicationId, input.bucketId, input.key)) ?? undefined;
      return { session: completed, url: upload.publicObjectUrl, object };
    }

    return { session, url: upload.publicObjectUrl };
  }

  /**
   * Upload many files concurrently. Each file is uploaded independently; a
   * failure for one file does not abort the others — inspect each item's
   * `error`/`result`.
   *
   * @param inputs - The files to upload.
   * @param options - Concurrency limit and an aggregated progress callback.
   * @returns One result per input, in the same order.
   *
   * @example
   * ```ts
   * const results = await client.applications.storage.uploadBatch(
   *   files.map((f) => ({ applicationId, bucketId, key: `uploads/${f.name}`, data: f })),
   *   { concurrency: 6, onProgress: (done, total) => console.log(`${done}/${total}`) },
   * );
   * const failed = results.filter((r) => r.error);
   * ```
   */
  async uploadBatch(inputs: UploadFileInput[], options?: UploadBatchOptions): Promise<UploadBatchItemResult[]> {
    const concurrency = Math.max(1, options?.concurrency ?? 4);
    const results: UploadBatchItemResult[] = new Array(inputs.length);
    let completed = 0;
    let next = 0;

    const worker = async (): Promise<void> => {
      for (;;) {
        const index = next++;
        if (index >= inputs.length) return;
        try {
          results[index] = { input: inputs[index], result: await this.upload(inputs[index]) };
        } catch (error) {
          results[index] = { input: inputs[index], error };
        }
        completed++;
        options?.onProgress?.(completed, inputs.length);
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, inputs.length) }, () => worker()));
    return results;
  }

  /**
   * Poll an upload session until the object is finalized server-side.
   *
   * @param applicationId - The application ID (UUID).
   * @param bucketId - The bucket ID (UUID).
   * @param sessionId - The upload session ID (UUID).
   * @param options - Timeout and polling interval.
   * @returns The completed session.
   * @throws {@link UploadError} if the session fails, expires, or the timeout elapses.
   */
  async waitForCompletion(
    applicationId: string,
    bucketId: string,
    sessionId: string,
    options?: WaitForCompletionOptions
  ): Promise<StorageUploadSession> {
    const timeoutMs = options?.timeoutMs ?? 60_000;
    const pollIntervalMs = options?.pollIntervalMs ?? 1000;
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      const session = await this.uploadSessions.get(applicationId, bucketId, sessionId);
      if (session.state === 'completed') return session;
      if (session.state === 'failed' || session.state === 'expired') {
        throw new UploadError(`Upload session ${session.state}.`);
      }
      if (Date.now() >= deadline) {
        throw new UploadError('Timed out waiting for the upload to complete.');
      }
      await delay(pollIntervalMs);
    }
  }
}

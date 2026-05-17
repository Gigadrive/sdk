import * as tus from 'tus-js-client';
import type { Paginated } from '../http-client';
import { BaseResource } from './base-resource';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Represents an upload session for a storage object. Upload sessions track
 * the lifecycle of a file upload from creation through completion.
 */
export interface StorageUploadSession {
  /** Unique identifier (UUID). */
  id: string;
  /** The bucket this upload targets. */
  bucketId: string;
  /** The application this upload belongs to. */
  applicationId: string;
  /** The object key/path the file will be stored at (e.g. `"images/photo.jpg"`). */
  key: string;
  /** MIME content type declared at creation, or `null` if not specified. */
  contentType: string | null;
  /** Expected file size in bytes declared at creation, or `null`. */
  contentLength: number | null;
  /** SHA-1 checksum for server-side verification, if provided. */
  checksumSha1: string | null;
  /** SHA-256 checksum for server-side verification, if provided. */
  checksumSha256: string | null;
  /** MD5 checksum for server-side verification, if provided. */
  checksumMd5: string | null;
  /**
   * Current session state:
   * - `"pending"` — Session created, provider setup in progress.
   * - `"ready"` — Ready to receive file data.
   * - `"completed"` — Upload verified and storage object created.
   * - `"failed"` — Upload failed or was rejected.
   * - `"expired"` — Session exceeded its expiration time.
   */
  state: 'pending' | 'ready' | 'completed' | 'failed' | 'expired';
  /** ISO 8601 timestamp when this session expires. */
  expiresAt: string;
  /** ISO 8601 timestamp when the upload was finalized, or `null`. */
  uploadedAt: string | null;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 last-updated timestamp. */
  updatedAt: string;
}

/** Input for creating a new upload session. */
export interface CreateUploadSessionInput {
  /** The object key/path the file will be stored at (e.g. `"images/photo.jpg"`). 1-1024 characters. */
  key: string;
  /** MIME content type of the file (e.g. `"image/jpeg"`). */
  contentType?: string;
  /** File size in bytes. Required for resumable uploads. */
  contentLength: number;
  /** SHA-1 checksum (40 hex chars) for server-side integrity verification. */
  checksumSha1?: string;
  /** SHA-256 checksum (64 hex chars) for server-side integrity verification. */
  checksumSha256?: string;
  /** MD5 checksum (32 hex chars) for server-side integrity verification. */
  checksumMd5?: string;
}

/**
 * Response from creating an upload session. Contains both the session
 * metadata and the TUS upload instructions (URL, method, headers).
 */
export interface CreateUploadSessionResponse {
  /** The created upload session. */
  session: StorageUploadSession;
  /** TUS upload instructions — use these to send the file data. */
  upload: {
    /** Always `"PATCH"` (TUS protocol). */
    method: 'PATCH';
    /** Signed TUS upload URL. Send your file data here. */
    url: string;
    /** Required headers to include with the upload request (includes `Tus-Resumable`). */
    headers: Record<string, string>;
    /** The public CDN URL where the object will be accessible after upload. */
    publicObjectUrl: string;
  };
}

/**
 * Options for the {@link StorageUploadSessionsResource.upload | upload()} and
 * {@link StorageUploadSessionsResource.uploadToUrl | uploadToUrl()} methods.
 */
export interface UploadOptions {
  /** MIME content type of the file (e.g. `"image/jpeg"`, `"application/pdf"`). */
  contentType?: string;
  /** SHA-1 checksum (40 hex chars) for server-side integrity verification after upload. */
  checksumSha1?: string;
  /** SHA-256 checksum (64 hex chars) for server-side integrity verification after upload. */
  checksumSha256?: string;
  /** MD5 checksum (32 hex chars) for server-side integrity verification after upload. */
  checksumMd5?: string;
  /**
   * Maximum chunk size in bytes for the TUS upload. Each chunk is held in
   * memory for retry support.
   *
   * - Default: `Infinity` (upload the entire file in a single PATCH request).
   * - Set a finite value (e.g. `10 * 1024 * 1024` for 10 MB) when uploading
   *   very large files or streams to keep memory usage bounded.
   * - Smaller values increase HTTP overhead. Only set this when needed.
   */
  chunkSize?: number;
  /**
   * Retry delays in milliseconds. Each element represents the delay before
   * the corresponding retry attempt. The upload fails permanently after all
   * retries are exhausted.
   *
   * Default: `[0, 1000, 3000, 5000]` (4 retries with increasing delays).
   * Set to `null` or `[]` to disable retries.
   */
  retryDelays?: number[];
  /**
   * Progress callback, invoked periodically during upload.
   *
   * @param bytesSent - Number of bytes uploaded so far.
   * @param bytesTotal - Total file size in bytes.
   *
   * @example
   * ```ts
   * onProgress: (sent, total) => {
   *   console.log(`${Math.round((sent / total) * 100)}%`);
   * }
   * ```
   */
  onProgress?: (bytesSent: number, bytesTotal: number) => void;
}

/**
 * Accepted file input types for uploads. The SDK uses `tus-js-client` under
 * the hood, which accepts different types depending on the runtime:
 *
 * - **Browser:** `File` (from `<input type="file">`), `Blob`
 * - **Node.js:** `Buffer` (from `fs.readFileSync`, etc.)
 * - **Universal:** `ReadableStreamDefaultReader`
 */
export type UploadInput = File | Blob | Buffer | Pick<ReadableStreamDefaultReader, 'read'>;

/**
 * Result of a successful {@link StorageUploadSessionsResource.upload | upload()} call.
 */
export interface UploadResult {
  /** The upload session. Check `session.state` or poll with `get()` to track server-side processing. */
  session: StorageUploadSession;
  /** The public CDN URL of the uploaded object (e.g. `"https://cdn.example.com/images/photo.jpg"`). */
  url: string;
}

// ---------------------------------------------------------------------------
// Resource
// ---------------------------------------------------------------------------

/**
 * Manage upload sessions and upload files to storage buckets using the
 * TUS resumable upload protocol. Accessed via
 * `client.applications.storage.uploadSessions`.
 *
 * For most use cases, the high-level {@link upload} method is all you need —
 * it creates the session, uploads the file with automatic retries, and returns
 * the public CDN URL.
 *
 * @example
 * ```ts
 * // Simple file upload (Node.js)
 * import { readFileSync } from 'node:fs';
 *
 * const { url } = await client.applications.storage.uploadSessions.upload(
 *   'app-id', 'bucket-id', 'photos/cat.jpg',
 *   readFileSync('./cat.jpg'),
 *   { contentType: 'image/jpeg' },
 * );
 * console.log(`Uploaded to ${url}`);
 *
 * // Browser file upload with progress
 * const file = document.querySelector('input[type=file]').files[0];
 * const { url } = await client.applications.storage.uploadSessions.upload(
 *   'app-id', 'bucket-id', file.name, file,
 *   {
 *     contentType: file.type,
 *     onProgress: (sent, total) => console.log(`${Math.round((sent / total) * 100)}%`),
 *   },
 * );
 * ```
 */
export class StorageUploadSessionsResource extends BaseResource {
  /**
   * List upload sessions for a bucket.
   *
   * @param applicationId - The application ID (UUID).
   * @param bucketId - The bucket ID (UUID).
   * @returns A paginated list of upload sessions.
   *
   * @example
   * ```ts
   * const { items } = await client.applications.storage.uploadSessions.list('app-id', 'bucket-id');
   * const pending = items.filter((s) => s.state === 'ready');
   * console.log(`${pending.length} uploads in progress`);
   * ```
   */
  async list(applicationId: string, bucketId: string): Promise<Paginated<StorageUploadSession>> {
    return this.httpClient.get(`/applications/${applicationId}/storage/buckets/${bucketId}/uploads`);
  }

  /**
   * Create an upload session. Returns the session metadata and a signed TUS
   * upload URL for sending file data. This is the low-level method — for most
   * use cases, prefer {@link upload} which handles the full flow.
   *
   * @param applicationId - The application ID (UUID).
   * @param bucketId - The bucket ID (UUID).
   * @param data - Object key, content length, and optional content type / checksums.
   * @returns The session and TUS upload instructions (URL, method, headers).
   *
   * @example
   * ```ts
   * // Low-level: create session, then upload manually
   * const { session, upload } = await client.applications.storage.uploadSessions.create(
   *   'app-id', 'bucket-id',
   *   { key: 'data.csv', contentLength: buffer.byteLength, contentType: 'text/csv' },
   * );
   *
   * // Use the returned upload.url and upload.headers with your own TUS client
   * console.log(`Upload to: ${upload.url}`);
   * console.log(`Public URL: ${upload.publicObjectUrl}`);
   * ```
   */
  async create(
    applicationId: string,
    bucketId: string,
    data: CreateUploadSessionInput
  ): Promise<CreateUploadSessionResponse> {
    return this.httpClient.post(`/applications/${applicationId}/storage/buckets/${bucketId}/uploads`, data);
  }

  /**
   * Get an upload session by ID. Use this to check the status of an upload
   * after calling {@link upload} or {@link create}.
   *
   * @param applicationId - The application ID (UUID).
   * @param bucketId - The bucket ID (UUID).
   * @param sessionId - The upload session ID (UUID).
   * @returns The current session state.
   *
   * @example
   * ```ts
   * const session = await client.applications.storage.uploadSessions.get(
   *   'app-id', 'bucket-id', 'session-id',
   * );
   * console.log(`Upload state: ${session.state}`); // 'ready' | 'completed' | ...
   * ```
   */
  async get(applicationId: string, bucketId: string, sessionId: string): Promise<StorageUploadSession> {
    return this.httpClient.get(`/applications/${applicationId}/storage/buckets/${bucketId}/uploads/${sessionId}`);
  }

  /**
   * Upload a file to a storage bucket. This is the recommended high-level
   * method that handles the complete upload flow:
   *
   * 1. Creates an upload session with the API
   * 2. Uploads the file data using the TUS resumable upload protocol
   * 3. Returns the public CDN URL and session metadata
   *
   * The upload is automatically retried on transient failures. Use
   * {@link UploadOptions.chunkSize} to control memory usage for large files.
   *
   * Supports `File` (browser), `Blob` (browser), `Buffer` (Node.js), and
   * `ReadableStreamDefaultReader` (universal).
   *
   * @param applicationId - The application ID (UUID).
   * @param bucketId - The bucket ID (UUID).
   * @param key - The object key/path in the bucket (e.g. `"images/logo.png"`).
   * @param data - The file data to upload.
   * @param options - Content type, checksums, chunk size, retry config, and progress callback.
   * @returns The upload session and the public CDN URL of the object.
   * @throws {@link ApiError} if the session creation fails.
   * @throws Error if the TUS upload fails after all retries.
   *
   * @example
   * ```ts
   * // Node.js — upload a file from disk
   * import { readFileSync } from 'node:fs';
   *
   * const { url } = await client.applications.storage.uploadSessions.upload(
   *   'app-id', 'bucket-id', 'reports/q1.pdf',
   *   readFileSync('./q1-report.pdf'),
   *   { contentType: 'application/pdf' },
   * );
   * console.log(`Available at: ${url}`);
   *
   * // Browser — upload from file input with progress tracking
   * const file = document.querySelector<HTMLInputElement>('#upload')!.files![0];
   * const { url } = await client.applications.storage.uploadSessions.upload(
   *   'app-id', 'bucket-id', `uploads/${file.name}`, file,
   *   {
   *     contentType: file.type,
   *     onProgress: (sent, total) => {
   *       progressBar.value = Math.round((sent / total) * 100);
   *     },
   *   },
   * );
   *
   * // Large file with chunked upload (10 MB chunks)
   * const { url } = await client.applications.storage.uploadSessions.upload(
   *   'app-id', 'bucket-id', 'backups/db.sql.gz',
   *   largeBuffer,
   *   { contentType: 'application/gzip', chunkSize: 10 * 1024 * 1024 },
   * );
   * ```
   */
  async upload(
    applicationId: string,
    bucketId: string,
    key: string,
    data: UploadInput,
    options?: UploadOptions
  ): Promise<UploadResult> {
    const contentLength = getSize(data);

    const { session, upload: uploadInfo } = await this.create(applicationId, bucketId, {
      key,
      contentLength,
      contentType: options?.contentType,
      checksumSha1: options?.checksumSha1,
      checksumSha256: options?.checksumSha256,
      checksumMd5: options?.checksumMd5,
    });

    await tusUpload(data, {
      uploadUrl: uploadInfo.url,
      headers: uploadInfo.headers,
      chunkSize: options?.chunkSize,
      retryDelays: options?.retryDelays,
      onProgress: options?.onProgress,
      uploadSize: contentLength,
    });

    return { session, url: uploadInfo.publicObjectUrl };
  }

  /**
   * Upload a file directly to a pre-existing TUS upload URL. Use this when
   * you already have a signed upload URL — for example, from a token passed
   * by another service, or from a previous {@link create} call.
   *
   * This skips session creation and sends the file data directly to the
   * provided URL using the TUS resumable upload protocol.
   *
   * @param url - A signed TUS upload URL (e.g. with `?upload_token=...`).
   * @param data - The file data to upload.
   * @param options - Chunk size, retry config, and progress callback.
   * @throws Error if the TUS upload fails after all retries.
   *
   * @example
   * ```ts
   * // Upload using a signed URL from your backend
   * await client.applications.storage.uploadSessions.uploadToUrl(
   *   'https://cdn.example.com/photos/img.jpg?upload_token=eyJ...',
   *   imageBuffer,
   *   {
   *     onProgress: (sent, total) => console.log(`${sent}/${total}`),
   *   },
   * );
   *
   * // Resume a previously created session
   * const { upload } = await client.applications.storage.uploadSessions.create(...);
   * // ... later, or in a different process:
   * await client.applications.storage.uploadSessions.uploadToUrl(upload.url, fileData);
   * ```
   */
  async uploadToUrl(
    url: string,
    data: UploadInput,
    options?: Omit<UploadOptions, 'checksumSha1' | 'checksumSha256' | 'checksumMd5'>
  ): Promise<void> {
    await tusUpload(data, {
      uploadUrl: url,
      headers: { 'Tus-Resumable': '1.0.0' },
      chunkSize: options?.chunkSize,
      retryDelays: options?.retryDelays,
      onProgress: options?.onProgress,
      uploadSize: getSize(data),
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getSize = (data: UploadInput): number => {
  if (typeof Blob !== 'undefined' && data instanceof Blob) return data.size;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) return data.byteLength;
  throw new Error('Cannot determine file size. Pass a File, Blob, or Buffer, or set contentLength explicitly.');
};

interface TusUploadOptions {
  uploadUrl: string;
  headers: Record<string, string>;
  uploadSize: number;
  chunkSize?: number;
  retryDelays?: number[];
  onProgress?: (bytesSent: number, bytesTotal: number) => void;
}

const tusUpload = (data: UploadInput, options: TusUploadOptions): Promise<void> =>
  new Promise((resolve, reject) => {
    const upload = new tus.Upload(data as tus.Upload['file'], {
      uploadUrl: options.uploadUrl,
      uploadSize: options.uploadSize,
      headers: options.headers,
      chunkSize: options.chunkSize ?? Infinity,
      retryDelays: options.retryDelays ?? [0, 1000, 3000, 5000],
      storeFingerprintForResuming: false,
      onError: reject,
      onProgress: options.onProgress ?? null,
      onSuccess: () => resolve(),
    });

    upload.start();
  });

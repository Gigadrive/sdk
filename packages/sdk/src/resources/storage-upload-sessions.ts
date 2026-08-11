import type { ListQuery, Paginated } from '../http-client';
import { resolveUploadSource, type NodeReadableLike, type UploadData } from '../upload/source';
import {
  runResolvedUpload,
  toUploadError,
  tusUploadTransport,
  type RunUploadOptions,
  type UploadTransport,
} from '../upload/transport';
import { BaseResource } from './base-resource';
import {
  resolveStorageApplicationId,
  type StorageBucketReference,
  type StorageEnvironmentOptions,
} from './storage-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Represents an upload session for a storage object. Upload sessions track the
 * lifecycle of a file upload from creation through completion.
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
   * - `"pending"` — Session created, awaiting the first bytes.
   * - `"ready"` — Receiving file data.
   * - `"completed"` — Upload verified and storage object created.
   * - `"failed"` — Upload failed or was rejected.
   * - `"expired"` — Session exceeded its expiration time.
   */
  state: 'pending' | 'ready' | 'completed' | 'failed' | 'expired';
  /** ISO 8601 timestamp when this session (and its upload URL) expires. */
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
  /** The object key/path the file will be stored at (e.g. `"images/photo.jpg"`). 1–1024 characters. */
  key: string;
  /** File size in bytes. Required. */
  contentLength: number;
  /** Lowercase hex SHA-256 checksum (64 chars) of the content. Required for server-side verification. */
  checksumSha256: string;
  /** MIME content type of the file (e.g. `"image/jpeg"`). */
  contentType?: string;
  /** Optional lowercase hex SHA-1 checksum (40 chars). */
  checksumSha1?: string;
  /** Optional lowercase hex MD5 checksum (32 chars). */
  checksumMd5?: string;
}

/** Query parameters for listing upload sessions in a bucket. */
export interface ListStorageUploadSessionsQuery extends ListQuery, StorageEnvironmentOptions {}

/**
 * Response from creating an upload session. Contains both the session metadata
 * and the resumable upload instructions (signed URL + headers).
 */
export interface CreateUploadSessionResponse {
  /** The created upload session. */
  session: StorageUploadSession;
  /** Resumable upload instructions — use these to send the file data. */
  upload: {
    /** The HTTP method for the byte upload (resumable upload protocol). */
    method: 'PATCH';
    /** Signed upload URL. Send your file data here. */
    url: string;
    /** Required headers to include with the upload request. */
    headers: Record<string, string>;
    /** The URL where the object will be accessible after upload (CDN URL for public buckets). */
    publicObjectUrl: string;
  };
}

/** A byte source for uploading directly to a known signed URL. */
export interface UploadByteSource {
  /** In-memory data (`File`/`Blob`/`Buffer`/`Uint8Array`/`ArrayBuffer`). */
  data?: UploadData;
  /** A filesystem path to stream from (Node.js only). */
  path?: string;
  /** A readable stream (Node.js only). Requires `contentLength`. */
  stream?: NodeReadableLike;
  /** Byte size — required for `stream` inputs, computed otherwise. */
  contentLength?: number;
}

// ---------------------------------------------------------------------------
// Resource
// ---------------------------------------------------------------------------

/**
 * Manage upload sessions and upload bytes to a signed upload URL using the
 * resumable upload protocol. Accessed via `client.storage.uploadSessions`.
 *
 * For most use cases, prefer the high-level `client.storage.upload()`
 * which creates the session, computes the required checksum, uploads the bytes,
 * and returns the public URL.
 */
export class StorageUploadSessionsResource extends BaseResource {
  constructor(
    httpClient: ConstructorParameters<typeof BaseResource>[0],
    private readonly transport: UploadTransport = tusUploadTransport,
    private readonly defaultApplicationId?: string
  ) {
    super(httpClient);
  }

  /**
   * List upload sessions for a bucket.
   *
   * @param bucketRef - Canonical bucket name or deprecated UUID fallback.
   * @param query - Optional pagination parameters.
   * @returns A paginated list of upload sessions.
   */
  async list(
    bucketRef: StorageBucketReference,
    query?: ListStorageUploadSessionsQuery
  ): Promise<Paginated<StorageUploadSession>>;
  /** @deprecated Prefer the context-bound overload through `client.storage`. */
  async list(
    applicationId: string,
    bucketRef: StorageBucketReference,
    query?: ListStorageUploadSessionsQuery
  ): Promise<Paginated<StorageUploadSession>>;
  async list(
    applicationIdOrBucketRef: string,
    bucketRefOrQuery?: string | ListStorageUploadSessionsQuery,
    legacyQuery?: ListStorageUploadSessionsQuery
  ): Promise<Paginated<StorageUploadSession>> {
    const explicitApplication = typeof bucketRefOrQuery === 'string';
    const applicationId = resolveStorageApplicationId(
      this.defaultApplicationId,
      explicitApplication ? applicationIdOrBucketRef : undefined
    );
    const bucketRef = explicitApplication ? bucketRefOrQuery : applicationIdOrBucketRef;
    const query = explicitApplication ? legacyQuery : bucketRefOrQuery;
    return this.httpClient.get(`/applications/${applicationId}/storage/buckets/${bucketRef}/uploads`, {
      query: query as Record<string, string | number | undefined> | undefined,
    });
  }

  /**
   * Create an upload session. Returns the session metadata and a signed upload
   * URL for sending file data. This is the low-level method — for most use
   * cases prefer `client.storage.upload()` which also computes the
   * required SHA-256 checksum for you.
   *
   * @param bucketRef - Canonical bucket name or deprecated UUID fallback.
   * @param data - Object key, content length, SHA-256 checksum, and optional content type / extra checksums.
   * @returns The session and resumable upload instructions (URL, method, headers).
   */
  async create(
    bucketRef: StorageBucketReference,
    data: CreateUploadSessionInput,
    options?: StorageEnvironmentOptions
  ): Promise<CreateUploadSessionResponse>;
  /** @deprecated Prefer the context-bound overload through `client.storage`. */
  async create(
    applicationId: string,
    bucketRef: StorageBucketReference,
    data: CreateUploadSessionInput,
    options?: StorageEnvironmentOptions
  ): Promise<CreateUploadSessionResponse>;
  async create(
    applicationIdOrBucketRef: string,
    bucketRefOrData: string | CreateUploadSessionInput,
    dataOrOptions?: CreateUploadSessionInput | StorageEnvironmentOptions,
    legacyOptions?: StorageEnvironmentOptions
  ): Promise<CreateUploadSessionResponse> {
    const explicitApplication = typeof bucketRefOrData === 'string';
    const applicationId = resolveStorageApplicationId(
      this.defaultApplicationId,
      explicitApplication ? applicationIdOrBucketRef : undefined
    );
    const bucketRef = explicitApplication ? bucketRefOrData : applicationIdOrBucketRef;
    const data = explicitApplication ? (dataOrOptions as CreateUploadSessionInput) : bucketRefOrData;
    const options = explicitApplication ? legacyOptions : (dataOrOptions as StorageEnvironmentOptions | undefined);
    return this.httpClient.post(`/applications/${applicationId}/storage/buckets/${bucketRef}/uploads`, data, {
      query: { environment: options?.environment },
    });
  }

  /**
   * Get an upload session by ID. Use this to track server-side processing after
   * an upload (poll until `state === 'completed'`).
   *
   * @param bucketRef - Canonical bucket name or deprecated UUID fallback.
   * @param sessionId - The upload session ID (UUID).
   * @returns The current session state.
   */
  async get(
    bucketRef: StorageBucketReference,
    sessionId: string,
    options?: StorageEnvironmentOptions
  ): Promise<StorageUploadSession>;
  /** @deprecated Prefer the context-bound overload through `client.storage`. */
  async get(
    applicationId: string,
    bucketRef: StorageBucketReference,
    sessionId: string,
    options?: StorageEnvironmentOptions
  ): Promise<StorageUploadSession>;
  async get(
    applicationIdOrBucketRef: string,
    bucketRefOrSessionId: string,
    sessionIdOrOptions?: string | StorageEnvironmentOptions,
    legacyOptions?: StorageEnvironmentOptions
  ): Promise<StorageUploadSession> {
    const explicitApplication = typeof sessionIdOrOptions === 'string';
    const applicationId = resolveStorageApplicationId(
      this.defaultApplicationId,
      explicitApplication ? applicationIdOrBucketRef : undefined
    );
    const bucketRef = explicitApplication ? bucketRefOrSessionId : applicationIdOrBucketRef;
    const sessionId = explicitApplication ? sessionIdOrOptions : bucketRefOrSessionId;
    const options = explicitApplication ? legacyOptions : sessionIdOrOptions;
    return this.httpClient.get(`/applications/${applicationId}/storage/buckets/${bucketRef}/uploads/${sessionId}`, {
      query: { environment: options?.environment },
    });
  }

  /**
   * Upload bytes directly to a pre-existing signed upload URL — for example, a
   * URL returned by {@link create} or handed to your client by a backend. Skips
   * session creation and checksum computation.
   *
   * @param url - A signed upload URL.
   * @param source - The bytes to upload.
   * @param options - Chunk size, retry config, progress, abort signal, resume,
   *   and any required `headers` returned with the upload session.
   * @throws {@link UploadError} if the upload fails after all retries.
   */
  async uploadToUrl(
    url: string,
    source: UploadByteSource,
    options?: RunUploadOptions & { headers?: Record<string, string> }
  ): Promise<void> {
    const resolved = await resolveUploadSource({ key: '', ...source }, { hash: false });
    const headers = { 'Tus-Resumable': '1.0.0', ...options?.headers };
    await runResolvedUpload(this.transport, url, resolved, options, headers).catch(toUploadError);
  }

  /**
   * Resume an interrupted upload to a previously issued signed upload URL. The
   * resumable protocol negotiates the current offset and continues from there.
   *
   * @param url - The signed upload URL from the original {@link create} call.
   * @param source - The full bytes to upload (the same content as the original).
   * @param options - Chunk size, retry config, progress, abort signal.
   */
  async resumeFromUrl(
    url: string,
    source: UploadByteSource,
    options?: RunUploadOptions & { headers?: Record<string, string> }
  ): Promise<void> {
    return this.uploadToUrl(url, source, { ...options, resume: true });
  }
}

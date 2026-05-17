import type { Paginated } from '../http-client';
import { BaseResource } from './base-resource';

/** A file (object) stored in a storage bucket. */
export interface StorageObject {
  /** Unique identifier (UUID). */
  id: string;
  /** The bucket this object belongs to. */
  bucketId: string;
  /** The application this object belongs to. */
  applicationId: string;
  /** The upload session that created this object, if applicable. */
  uploadSessionId: string | null;
  /** The object key (path) within the bucket (e.g. `"images/photo.jpg"`). */
  key: string;
  /** MIME content type (e.g. `"image/jpeg"`), or `null` if not set. */
  contentType: string | null;
  /** File size in bytes. */
  contentLength: number;
  /** SHA-1 checksum of the file contents, if available. */
  checksumSha1: string | null;
  /** SHA-256 checksum of the file contents, if available. */
  checksumSha256: string | null;
  /** MD5 checksum of the file contents, if available. */
  checksumMd5: string | null;
  /** Provider-internal file/version identifier. */
  providerFileId: string;
  /** Provider-internal canonical object name. */
  providerFileName: string;
  /** ISO 8601 timestamp of when the upload was finalized at the provider. */
  uploadedAt: string;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 last-updated timestamp. */
  updatedAt: string;
}

/**
 * Access URL details for a storage object. For public buckets, the URL is
 * permanent. For private buckets, the URL is time-limited and signed.
 */
export interface StorageObjectAccess {
  /** `"public"` for permanent URLs, `"signed"` for time-limited signed URLs. */
  accessType: 'public' | 'signed';
  /** The URL to access the object. */
  url: string;
  /** ISO 8601 expiry timestamp for signed URLs. `null` for public URLs. */
  expiresAt: string | null;
}

/**
 * Read and delete objects in storage buckets, and generate access URLs.
 * Accessed via `client.applications.storage.objects`.
 *
 * To upload objects, use {@link StorageUploadSessionsResource.upload} via
 * `client.applications.storage.uploadSessions.upload()`.
 *
 * @example
 * ```ts
 * // List all objects in a bucket
 * const { items } = await client.applications.storage.objects.list('app-id', 'bucket-id');
 * for (const obj of items) {
 *   console.log(`${obj.key} (${obj.contentLength} bytes)`);
 * }
 *
 * // Get a signed download URL for a private object
 * const { url } = await client.applications.storage.objects.getAccessUrl('app-id', 'object-id');
 * ```
 */
export class StorageObjectsResource extends BaseResource {
  /**
   * List all objects in a storage bucket.
   *
   * @param applicationId - The application ID (UUID).
   * @param bucketId - The bucket ID (UUID).
   * @returns A paginated list of storage objects.
   *
   * @example
   * ```ts
   * const { items, total } = await client.applications.storage.objects.list('app-id', 'bucket-id');
   * console.log(`${total} objects in bucket`);
   * ```
   */
  async list(applicationId: string, bucketId: string): Promise<Paginated<StorageObject>> {
    return this.httpClient.get(`/applications/${applicationId}/storage/buckets/${bucketId}/objects`);
  }

  /**
   * Get metadata for a specific object by its key (path).
   *
   * @param applicationId - The application ID (UUID).
   * @param bucketId - The bucket ID (UUID).
   * @param objectKey - The object key/path (e.g. `"images/photo.jpg"`). Automatically URL-encoded.
   * @returns The object metadata.
   *
   * @example
   * ```ts
   * const obj = await client.applications.storage.objects.get('app-id', 'bucket-id', 'docs/report.pdf');
   * console.log(`${obj.key}: ${obj.contentLength} bytes, type: ${obj.contentType}`);
   * ```
   */
  async get(applicationId: string, bucketId: string, objectKey: string): Promise<StorageObject> {
    return this.httpClient.get(
      `/applications/${applicationId}/storage/buckets/${bucketId}/objects/${encodeURIComponent(objectKey)}`
    );
  }

  /**
   * Permanently delete an object from a storage bucket.
   *
   * @param applicationId - The application ID (UUID).
   * @param bucketId - The bucket ID (UUID).
   * @param objectKey - The object key/path to delete. Automatically URL-encoded.
   *
   * @example
   * ```ts
   * await client.applications.storage.objects.delete('app-id', 'bucket-id', 'temp/old-file.txt');
   * ```
   */
  async delete(applicationId: string, bucketId: string, objectKey: string): Promise<void> {
    return this.httpClient.delete(
      `/applications/${applicationId}/storage/buckets/${bucketId}/objects/${encodeURIComponent(objectKey)}`
    );
  }

  /**
   * Get an access URL for a storage object. For objects in public buckets,
   * returns a permanent CDN URL. For private buckets, returns a time-limited
   * signed URL.
   *
   * @param applicationId - The application ID (UUID).
   * @param objectId - The object ID (UUID) — not the object key.
   * @returns The access URL and its type/expiry.
   *
   * @example
   * ```ts
   * const access = await client.applications.storage.objects.getAccessUrl('app-id', 'object-id');
   * if (access.accessType === 'signed') {
   *   console.log(`Signed URL expires at ${access.expiresAt}`);
   * }
   * console.log(`Download: ${access.url}`);
   * ```
   */
  async getAccessUrl(applicationId: string, objectId: string): Promise<StorageObjectAccess> {
    return this.httpClient.get(`/applications/${applicationId}/storage/objects/${objectId}/access-url`);
  }
}

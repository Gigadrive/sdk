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
  /** The upload session that created this object, or `null` for imported objects. */
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
  /** ISO 8601 timestamp of when the upload was finalized. */
  uploadedAt: string;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 last-updated timestamp. */
  updatedAt: string;
}

/**
 * Access URL details for a storage object. For public buckets, the URL is a
 * stable CDN URL. For private buckets, the URL is time-limited and signed.
 */
export interface StorageObjectAccess {
  /** `"public"` for stable CDN URLs, `"signed"` for time-limited signed URLs. */
  accessType: 'public' | 'signed';
  /** The URL to access the object. */
  url: string;
  /** ISO 8601 expiry timestamp for signed URLs. `null` for public URLs. */
  expiresAt: string | null;
}

/** Query parameters for listing objects in a bucket. */
export interface ListStorageObjectsQuery {
  /** Only return objects whose key starts with this prefix. */
  prefix?: string;
  /** Group keys by this delimiter into `commonPrefixes` (virtual folders). Defaults to `"/"`. */
  delimiter?: string;
  /** Opaque cursor from a previous response's `nextCursor`. */
  cursor?: string;
  /** Maximum number of objects to return (1–1000, default 200). */
  limit?: number;
}

/** A page of storage objects, including any common (folder) prefixes. */
export interface StorageObjectList extends Paginated<StorageObject> {
  /** Virtual "folder" prefixes at the current level when a delimiter is used. */
  commonPrefixes: string[];
}

/**
 * Read and delete objects in storage buckets, and generate access URLs.
 * Accessed via `client.applications.storage.objects`.
 *
 * Objects are addressed by their object ID (UUID). If you only have the object
 * key, use {@link getByKey} to resolve it, or read the `id` from a listing.
 *
 * To upload objects, use `client.applications.storage.upload()`.
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
 * const { url } = await client.applications.storage.objects.getAccessUrl('app-id', 'bucket-id', 'object-id');
 * ```
 */
export class StorageObjectsResource extends BaseResource {
  /**
   * List objects in a storage bucket, optionally filtered by key prefix and
   * grouped into virtual folders by a delimiter.
   *
   * @param applicationId - The application ID (UUID).
   * @param bucketId - The bucket ID (UUID).
   * @param query - Optional prefix/delimiter/cursor/limit parameters.
   * @returns A page of objects plus any common (folder) prefixes and a `nextCursor`.
   *
   * @example
   * ```ts
   * // List the "images/" folder, one level deep
   * const { items, commonPrefixes, nextCursor } = await client.applications.storage.objects.list(
   *   'app-id', 'bucket-id', { prefix: 'images/', limit: 100 },
   * );
   * ```
   */
  async list(applicationId: string, bucketId: string, query?: ListStorageObjectsQuery): Promise<StorageObjectList> {
    return this.httpClient.get(`/applications/${applicationId}/storage/buckets/${bucketId}/objects`, {
      query: query as Record<string, string | number | undefined> | undefined,
    });
  }

  /**
   * Get metadata for a specific object by its object ID.
   *
   * @param applicationId - The application ID (UUID).
   * @param bucketId - The bucket ID (UUID).
   * @param objectId - The object ID (UUID) — not the object key. Use {@link getByKey} to resolve a key.
   * @returns The object metadata.
   *
   * @example
   * ```ts
   * const obj = await client.applications.storage.objects.get('app-id', 'bucket-id', 'object-id');
   * console.log(`${obj.key}: ${obj.contentLength} bytes, type: ${obj.contentType}`);
   * ```
   */
  async get(applicationId: string, bucketId: string, objectId: string): Promise<StorageObject> {
    return this.httpClient.get(`/applications/${applicationId}/storage/buckets/${bucketId}/objects/${objectId}`);
  }

  /**
   * Resolve an object by its key (path) instead of its ID. Convenience over
   * {@link list} — lists with the key as the prefix and returns the exact match,
   * paging through results until found, or `null` if no object with that key
   * exists. (The API has no get-by-key endpoint.)
   *
   * @param applicationId - The application ID (UUID).
   * @param bucketId - The bucket ID (UUID).
   * @param key - The object key/path (e.g. `"images/photo.jpg"`).
   * @returns The matching object, or `null` if not found.
   */
  async getByKey(applicationId: string, bucketId: string, key: string): Promise<StorageObject | null> {
    let cursor: string | undefined;
    do {
      const page = await this.list(applicationId, bucketId, { prefix: key, delimiter: '', cursor });
      const match = page.items.find((object) => object.key === key);
      if (match) return match;
      cursor = page.nextCursor;
    } while (cursor);
    return null;
  }

  /**
   * Permanently delete an object from a storage bucket.
   *
   * @param applicationId - The application ID (UUID).
   * @param bucketId - The bucket ID (UUID).
   * @param objectId - The object ID (UUID) — not the object key.
   *
   * @example
   * ```ts
   * await client.applications.storage.objects.delete('app-id', 'bucket-id', 'object-id');
   * ```
   */
  async delete(applicationId: string, bucketId: string, objectId: string): Promise<void> {
    return this.httpClient.delete(`/applications/${applicationId}/storage/buckets/${bucketId}/objects/${objectId}`);
  }

  /**
   * Get an access URL for a storage object. For objects in public buckets,
   * returns a stable CDN URL. For private buckets, returns a time-limited
   * signed URL.
   *
   * @param applicationId - The application ID (UUID).
   * @param bucketId - The bucket ID (UUID).
   * @param objectId - The object ID (UUID) — not the object key.
   * @param options - Optional `expiresInSeconds` for signed URLs (60–86400).
   * @returns The access URL and its type/expiry.
   *
   * @example
   * ```ts
   * const access = await client.applications.storage.objects.getAccessUrl('app-id', 'bucket-id', 'object-id', {
   *   expiresInSeconds: 3600,
   * });
   * if (access.accessType === 'signed') {
   *   console.log(`Signed URL expires at ${access.expiresAt}`);
   * }
   * console.log(`Download: ${access.url}`);
   * ```
   */
  async getAccessUrl(
    applicationId: string,
    bucketId: string,
    objectId: string,
    options?: { expiresInSeconds?: number }
  ): Promise<StorageObjectAccess> {
    return this.httpClient.get(
      `/applications/${applicationId}/storage/buckets/${bucketId}/objects/${objectId}/access-url`,
      { query: { expiresInSeconds: options?.expiresInSeconds } }
    );
  }
}

import type { Paginated } from '../http-client';
import { BaseResource } from './base-resource';
import {
  resolveStorageApplicationId,
  type StorageBucketReference,
  type StorageEnvironmentOptions,
} from './storage-context';

/** A file stored in a storage bucket. */
export interface StorageObject {
  /** Unique object identifier (UUID). */
  id: string;
  /** Internal UUID of the bucket containing this object. */
  bucketId: string;
  /** The application this object belongs to. */
  applicationId: string;
  /** The upload session that created this object, or `null` for imported objects. */
  uploadSessionId: string | null;
  /** The object key within the bucket, such as `"images/photo.jpg"`. */
  key: string;
  /** MIME content type, or `null` when none was recorded. */
  contentType: string | null;
  /** File size in bytes. */
  contentLength: number;
  /** SHA-1 checksum, if available. */
  checksumSha1: string | null;
  /** SHA-256 checksum, if available. */
  checksumSha256: string | null;
  /** MD5 checksum, if available. */
  checksumMd5: string | null;
  /** ISO 8601 timestamp of upload finalization. */
  uploadedAt: string;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 last-updated timestamp. */
  updatedAt: string;
}

/** Access URL details for a public or private storage object. */
export interface StorageObjectAccess {
  /** `"public"` for stable CDN URLs or `"signed"` for expiring URLs. */
  accessType: 'public' | 'signed';
  /** URL used to read the object. */
  url: string;
  /** ISO 8601 expiry for signed URLs, or `null` for public URLs. */
  expiresAt: string | null;
}

/** Query parameters for listing objects in a bucket. */
export interface ListStorageObjectsQuery extends StorageEnvironmentOptions {
  /** Only return objects whose key starts with this prefix. */
  prefix?: string;
  /** Group keys by this delimiter into virtual folders. Defaults to `"/"`. */
  delimiter?: string;
  /** Opaque cursor from a previous response. */
  cursor?: string;
  /** Maximum objects to return, from 1 through 1000. */
  limit?: number;
}

/** Options for creating an object access URL. */
export interface StorageObjectAccessOptions extends StorageEnvironmentOptions {
  /** Signed URL lifetime in seconds, from 60 through 86,400. */
  expiresInSeconds?: number;
}

/** A page of storage objects, including any common virtual-folder prefixes. */
export interface StorageObjectList extends Paginated<StorageObject> {
  commonPrefixes: string[];
}

/**
 * Reads and soft-deletes objects and creates access URLs.
 *
 * The context-bound overloads use the application configured on the client.
 * Explicit application overloads remain available for management tools and
 * compatibility. Bucket references should be canonical names; UUIDs remain a
 * deprecated server-side fallback.
 */
export class StorageObjectsResource extends BaseResource {
  constructor(
    httpClient: ConstructorParameters<typeof BaseResource>[0],
    private readonly defaultApplicationId?: string
  ) {
    super(httpClient);
  }

  /** Lists objects in a bucket. */
  async list(bucketRef: StorageBucketReference, query?: ListStorageObjectsQuery): Promise<StorageObjectList>;
  /** @deprecated Prefer the context-bound overload through `client.storage`. */
  async list(
    applicationId: string,
    bucketRef: StorageBucketReference,
    query?: ListStorageObjectsQuery
  ): Promise<StorageObjectList>;
  async list(
    applicationIdOrBucketRef: string,
    bucketRefOrQuery?: string | ListStorageObjectsQuery,
    legacyQuery?: ListStorageObjectsQuery
  ): Promise<StorageObjectList> {
    const explicitApplication = typeof bucketRefOrQuery === 'string';
    const applicationId = resolveStorageApplicationId(
      this.defaultApplicationId,
      explicitApplication ? applicationIdOrBucketRef : undefined
    );
    const bucketRef = explicitApplication ? bucketRefOrQuery : applicationIdOrBucketRef;
    const query = explicitApplication ? legacyQuery : bucketRefOrQuery;
    return this.httpClient.get(`/applications/${applicationId}/storage/buckets/${bucketRef}/objects`, {
      query: query as Record<string, string | number | undefined> | undefined,
    });
  }

  /** Gets object metadata by object UUID. */
  async get(
    bucketRef: StorageBucketReference,
    objectId: string,
    options?: StorageEnvironmentOptions
  ): Promise<StorageObject>;
  /** @deprecated Prefer the context-bound overload through `client.storage`. */
  async get(
    applicationId: string,
    bucketRef: StorageBucketReference,
    objectId: string,
    options?: StorageEnvironmentOptions
  ): Promise<StorageObject>;
  async get(
    applicationIdOrBucketRef: string,
    bucketRefOrObjectId: string,
    objectIdOrOptions?: string | StorageEnvironmentOptions,
    legacyOptions?: StorageEnvironmentOptions
  ): Promise<StorageObject> {
    const explicitApplication = typeof objectIdOrOptions === 'string';
    const applicationId = resolveStorageApplicationId(
      this.defaultApplicationId,
      explicitApplication ? applicationIdOrBucketRef : undefined
    );
    const bucketRef = explicitApplication ? bucketRefOrObjectId : applicationIdOrBucketRef;
    const objectId = explicitApplication ? objectIdOrOptions : bucketRefOrObjectId;
    const options = explicitApplication ? legacyOptions : objectIdOrOptions;
    return this.httpClient.get(`/applications/${applicationId}/storage/buckets/${bucketRef}/objects/${objectId}`, {
      query: { environment: options?.environment },
    });
  }

  /**
   * Resolves an object by exact key by paging a prefix listing.
   *
   * The API has no get-by-key endpoint. This helper preserves the same
   * application, bucket, and environment across every page.
   */
  async getByKey(
    bucketRef: StorageBucketReference,
    key: string,
    options?: StorageEnvironmentOptions
  ): Promise<StorageObject | null>;
  /** @deprecated Prefer the context-bound overload through `client.storage`. */
  async getByKey(
    applicationId: string,
    bucketRef: StorageBucketReference,
    key: string,
    options?: StorageEnvironmentOptions
  ): Promise<StorageObject | null>;
  async getByKey(
    applicationIdOrBucketRef: string,
    bucketRefOrKey: string,
    keyOrOptions?: string | StorageEnvironmentOptions,
    legacyOptions?: StorageEnvironmentOptions
  ): Promise<StorageObject | null> {
    const explicitApplication = typeof keyOrOptions === 'string';
    const applicationId = resolveStorageApplicationId(
      this.defaultApplicationId,
      explicitApplication ? applicationIdOrBucketRef : undefined
    );
    const bucketRef = explicitApplication ? bucketRefOrKey : applicationIdOrBucketRef;
    const key = explicitApplication ? keyOrOptions : bucketRefOrKey;
    const options = explicitApplication ? legacyOptions : keyOrOptions;

    let cursor: string | undefined;
    do {
      const page = await this.list(applicationId, bucketRef, {
        environment: options?.environment,
        prefix: key,
        cursor,
      });
      const match = page.items.find((object) => object.key === key);
      if (match) return match;
      cursor = page.nextCursor;
    } while (cursor);
    return null;
  }

  /** Moves a live object into the bucket trash. */
  async delete(bucketRef: StorageBucketReference, objectId: string, options?: StorageEnvironmentOptions): Promise<void>;
  /** @deprecated Prefer the context-bound overload through `client.storage`. */
  async delete(
    applicationId: string,
    bucketRef: StorageBucketReference,
    objectId: string,
    options?: StorageEnvironmentOptions
  ): Promise<void>;
  async delete(
    applicationIdOrBucketRef: string,
    bucketRefOrObjectId: string,
    objectIdOrOptions?: string | StorageEnvironmentOptions,
    legacyOptions?: StorageEnvironmentOptions
  ): Promise<void> {
    const explicitApplication = typeof objectIdOrOptions === 'string';
    const applicationId = resolveStorageApplicationId(
      this.defaultApplicationId,
      explicitApplication ? applicationIdOrBucketRef : undefined
    );
    const bucketRef = explicitApplication ? bucketRefOrObjectId : applicationIdOrBucketRef;
    const objectId = explicitApplication ? objectIdOrOptions : bucketRefOrObjectId;
    const options = explicitApplication ? legacyOptions : objectIdOrOptions;
    return this.httpClient.delete(`/applications/${applicationId}/storage/buckets/${bucketRef}/objects/${objectId}`, {
      query: { environment: options?.environment },
    });
  }

  /** Creates a stable public or time-limited signed object URL. */
  async getAccessUrl(
    bucketRef: StorageBucketReference,
    objectId: string,
    options?: StorageObjectAccessOptions
  ): Promise<StorageObjectAccess>;
  /** @deprecated Prefer the context-bound overload through `client.storage`. */
  async getAccessUrl(
    applicationId: string,
    bucketRef: StorageBucketReference,
    objectId: string,
    options?: StorageObjectAccessOptions
  ): Promise<StorageObjectAccess>;
  async getAccessUrl(
    applicationIdOrBucketRef: string,
    bucketRefOrObjectId: string,
    objectIdOrOptions?: string | StorageObjectAccessOptions,
    legacyOptions?: StorageObjectAccessOptions
  ): Promise<StorageObjectAccess> {
    const explicitApplication = typeof objectIdOrOptions === 'string';
    const applicationId = resolveStorageApplicationId(
      this.defaultApplicationId,
      explicitApplication ? applicationIdOrBucketRef : undefined
    );
    const bucketRef = explicitApplication ? bucketRefOrObjectId : applicationIdOrBucketRef;
    const objectId = explicitApplication ? objectIdOrOptions : bucketRefOrObjectId;
    const options = explicitApplication ? legacyOptions : objectIdOrOptions;
    return this.httpClient.get(
      `/applications/${applicationId}/storage/buckets/${bucketRef}/objects/${objectId}/access-url`,
      { query: { environment: options?.environment, expiresInSeconds: options?.expiresInSeconds } }
    );
  }
}

import type { Paginated } from '../http-client';
import { BaseResource } from './base-resource';
import {
  encodeStorageBucketReference,
  resolveStorageApplicationId,
  type StorageBucketReference,
  type StorageEnvironmentOptions,
} from './storage-context';
import type { StorageObject } from './storage-objects';

/** A soft-deleted storage object returned by a bucket trash listing. */
export interface TrashedStorageObject extends StorageObject {
  /** ISO 8601 timestamp when the object was moved to trash. */
  deletedAt: string;
}

/** Query parameters for listing a bucket's trashed objects. */
export interface ListStorageTrashQuery extends StorageEnvironmentOptions {
  /** Only return trashed objects whose keys start with this prefix. */
  prefix?: string;
  /** Opaque cursor returned by a previous trash listing. */
  cursor?: string;
  /** Maximum objects to return, from 1 through 1000. */
  limit?: number;
}

/** A page of soft-deleted objects. */
export type StorageTrashList = Paginated<TrashedStorageObject>;

/** Result returned after permanently deleting every object in a bucket's trash. */
export interface EmptyStorageTrashResult {
  /** Number of trashed objects permanently deleted. */
  purgedCount: number;
}

/**
 * Manages the lifecycle of soft-deleted storage objects.
 *
 * Restoring can fail with HTTP 409 when a live object already uses the same
 * key. Purge and empty operations are irreversible.
 */
export class StorageTrashResource extends BaseResource {
  constructor(
    httpClient: ConstructorParameters<typeof BaseResource>[0],
    private readonly defaultApplicationId?: string
  ) {
    super(httpClient);
  }

  /** Lists soft-deleted objects in a bucket. */
  async list(bucketRef: StorageBucketReference, query?: ListStorageTrashQuery): Promise<StorageTrashList>;
  /** @deprecated Prefer the context-bound overload through `client.storage`. */
  async list(
    applicationId: string,
    bucketRef: StorageBucketReference,
    query?: ListStorageTrashQuery
  ): Promise<StorageTrashList>;
  async list(
    applicationIdOrBucketRef: string,
    bucketRefOrQuery?: string | ListStorageTrashQuery,
    legacyQuery?: ListStorageTrashQuery
  ): Promise<StorageTrashList> {
    const explicitApplication = typeof bucketRefOrQuery === 'string';
    const applicationId = resolveStorageApplicationId(
      this.defaultApplicationId,
      explicitApplication ? applicationIdOrBucketRef : undefined
    );
    const bucketRef = explicitApplication ? bucketRefOrQuery : applicationIdOrBucketRef;
    const query = explicitApplication ? legacyQuery : bucketRefOrQuery;
    return this.httpClient.get(
      `/applications/${applicationId}/storage/buckets/${encodeStorageBucketReference(bucketRef)}/trash`,
      { query: query as Record<string, string | number | undefined> | undefined }
    );
  }

  /** Restores a soft-deleted object to its original key. */
  async restore(
    bucketRef: StorageBucketReference,
    objectId: string,
    options?: StorageEnvironmentOptions
  ): Promise<StorageObject>;
  /** @deprecated Prefer the context-bound overload through `client.storage`. */
  async restore(
    applicationId: string,
    bucketRef: StorageBucketReference,
    objectId: string,
    options?: StorageEnvironmentOptions
  ): Promise<StorageObject>;
  async restore(
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
    return this.httpClient.post(
      `/applications/${applicationId}/storage/buckets/${encodeStorageBucketReference(bucketRef)}/trash/${objectId}/restore`,
      undefined,
      { query: { environment: options?.environment } }
    );
  }

  /** Permanently deletes one object from bucket trash. */
  async purge(bucketRef: StorageBucketReference, objectId: string, options?: StorageEnvironmentOptions): Promise<void>;
  /** @deprecated Prefer the context-bound overload through `client.storage`. */
  async purge(
    applicationId: string,
    bucketRef: StorageBucketReference,
    objectId: string,
    options?: StorageEnvironmentOptions
  ): Promise<void>;
  async purge(
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
    return this.httpClient.delete(
      `/applications/${applicationId}/storage/buckets/${encodeStorageBucketReference(bucketRef)}/trash/${objectId}`,
      { query: { environment: options?.environment } }
    );
  }

  /** Permanently deletes every object in a bucket's trash. */
  async empty(bucketRef: StorageBucketReference, options?: StorageEnvironmentOptions): Promise<EmptyStorageTrashResult>;
  /** @deprecated Prefer the context-bound overload through `client.storage`. */
  async empty(
    applicationId: string,
    bucketRef: StorageBucketReference,
    options?: StorageEnvironmentOptions
  ): Promise<EmptyStorageTrashResult>;
  async empty(
    applicationIdOrBucketRef: string,
    bucketRefOrOptions?: string | StorageEnvironmentOptions,
    legacyOptions?: StorageEnvironmentOptions
  ): Promise<EmptyStorageTrashResult> {
    const explicitApplication = typeof bucketRefOrOptions === 'string';
    const applicationId = resolveStorageApplicationId(
      this.defaultApplicationId,
      explicitApplication ? applicationIdOrBucketRef : undefined
    );
    const bucketRef = explicitApplication ? bucketRefOrOptions : applicationIdOrBucketRef;
    const options = explicitApplication ? legacyOptions : bucketRefOrOptions;
    return this.httpClient.delete(
      `/applications/${applicationId}/storage/buckets/${encodeStorageBucketReference(bucketRef)}/trash`,
      { query: { environment: options?.environment } }
    );
  }
}

import type { ListQuery, Paginated } from '../http-client';
import { BaseResource } from './base-resource';
import {
  encodeStorageBucketReference,
  resolveStorageApplicationId,
  type StorageBucketReference,
  type StorageEnvironmentOptions,
} from './storage-context';

/** A storage bucket belonging to one application environment. */
export interface StorageBucket {
  /**
   * Internal bucket UUID. New REST calls should use {@link name} instead.
   * @deprecated Use the environment-scoped bucket `name` for API addressing.
   */
  id: string;
  /** The application this bucket belongs to. */
  applicationId: string;
  /** Canonical immutable API/IaC identifier, unique within {@link environmentId}. */
  name: string;
  /** Global CDN/S3 identifier. This is not the bucket reference used by REST methods. */
  slug: string;
  /** `"public"` buckets use stable CDN URLs; `"private"` buckets require signed access URLs. */
  visibility: 'public' | 'private';
  /** Hostname used to serve public objects or signed private-object URLs. */
  cdnHostname: string;
  /** The application environment this bucket is scoped to. */
  environmentId: string;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 last-updated timestamp. */
  updatedAt: string;
}

interface CreateStorageBucketBase {
  /**
   * Immutable lowercase URL-safe identifier. The API accepts 3–63 ASCII
   * letters, numbers, and internal hyphens and does not normalize the value.
   */
  name: string;
  /** Bucket visibility. Defaults to `"private"`. */
  visibility?: 'public' | 'private';
  /**
   * Explicit global delivery/S3 slug.
   * @deprecated Omit this field and let the API generate the global slug.
   */
  slug?: string;
}

/** Input for creating an environment-scoped storage bucket. */
export type CreateStorageBucketInput = CreateStorageBucketBase &
  (
    | {
        /** Canonical environment slug or UUID. */
        environment: string;
        /**
         * Deprecated compatibility selector. When both fields are supplied,
         * they must resolve to the same environment.
         * @deprecated Use {@link environment}.
         */
        environmentId?: string;
      }
    | {
        environment?: undefined;
        /**
         * Application environment UUID.
         * @deprecated Use `environment` with an environment slug or UUID.
         */
        environmentId: string;
      }
  );

/** Query parameters for listing storage buckets. */
export interface ListStorageBucketsQuery extends ListQuery, StorageEnvironmentOptions {}

/**
 * Manages storage buckets for an application.
 *
 * Methods accept an application ID as their first argument for compatibility.
 * When the client has an application context, callers can omit it and address
 * buckets directly by their environment-scoped names.
 */
export class StorageBucketsResource extends BaseResource {
  constructor(
    httpClient: ConstructorParameters<typeof BaseResource>[0],
    private readonly defaultApplicationId?: string
  ) {
    super(httpClient);
  }

  /** Lists buckets, optionally restricted to an environment slug or UUID. */
  async list(query?: ListStorageBucketsQuery): Promise<Paginated<StorageBucket>>;
  /** @deprecated Prefer the context-bound overload through `client.storage`. */
  async list(applicationId: string, query?: ListStorageBucketsQuery): Promise<Paginated<StorageBucket>>;
  async list(
    applicationIdOrQuery?: string | ListStorageBucketsQuery,
    legacyQuery?: ListStorageBucketsQuery
  ): Promise<Paginated<StorageBucket>> {
    const applicationId = resolveStorageApplicationId(
      this.defaultApplicationId,
      typeof applicationIdOrQuery === 'string' ? applicationIdOrQuery : undefined
    );
    const query = typeof applicationIdOrQuery === 'string' ? legacyQuery : applicationIdOrQuery;
    return this.httpClient.get(`/applications/${applicationId}/storage/buckets`, {
      query: query as Record<string, string | number | undefined> | undefined,
    });
  }

  /** Creates a bucket with an immutable environment-scoped name. */
  async create(data: CreateStorageBucketInput): Promise<StorageBucket>;
  /** @deprecated Prefer the context-bound overload through `client.storage`. */
  async create(applicationId: string, data: CreateStorageBucketInput): Promise<StorageBucket>;
  async create(
    applicationIdOrData: string | CreateStorageBucketInput,
    legacyData?: CreateStorageBucketInput
  ): Promise<StorageBucket> {
    const applicationId = resolveStorageApplicationId(
      this.defaultApplicationId,
      typeof applicationIdOrData === 'string' ? applicationIdOrData : undefined
    );
    const data = typeof applicationIdOrData === 'string' ? legacyData! : applicationIdOrData;
    return this.httpClient.post(`/applications/${applicationId}/storage/buckets`, data);
  }

  /** Gets a bucket by canonical environment-scoped name or deprecated UUID. */
  async get(bucketRef: StorageBucketReference, options?: StorageEnvironmentOptions): Promise<StorageBucket>;
  /** @deprecated Prefer the context-bound overload through `client.storage`. */
  async get(
    applicationId: string,
    bucketRef: StorageBucketReference,
    options?: StorageEnvironmentOptions
  ): Promise<StorageBucket>;
  async get(
    applicationIdOrBucketRef: string,
    bucketRefOrOptions?: string | StorageEnvironmentOptions,
    legacyOptions?: StorageEnvironmentOptions
  ): Promise<StorageBucket> {
    const explicitApplication = typeof bucketRefOrOptions === 'string';
    const applicationId = resolveStorageApplicationId(
      this.defaultApplicationId,
      explicitApplication ? applicationIdOrBucketRef : undefined
    );
    const bucketRef = explicitApplication ? bucketRefOrOptions : applicationIdOrBucketRef;
    const options = explicitApplication ? legacyOptions : bucketRefOrOptions;
    return this.httpClient.get(
      `/applications/${applicationId}/storage/buckets/${encodeStorageBucketReference(bucketRef)}`,
      {
        query: { environment: options?.environment },
      }
    );
  }

  /** Permanently deletes a bucket and all of its live and trashed objects. */
  async delete(bucketRef: StorageBucketReference, options?: StorageEnvironmentOptions): Promise<void>;
  /** @deprecated Prefer the context-bound overload through `client.storage`. */
  async delete(
    applicationId: string,
    bucketRef: StorageBucketReference,
    options?: StorageEnvironmentOptions
  ): Promise<void>;
  async delete(
    applicationIdOrBucketRef: string,
    bucketRefOrOptions?: string | StorageEnvironmentOptions,
    legacyOptions?: StorageEnvironmentOptions
  ): Promise<void> {
    const explicitApplication = typeof bucketRefOrOptions === 'string';
    const applicationId = resolveStorageApplicationId(
      this.defaultApplicationId,
      explicitApplication ? applicationIdOrBucketRef : undefined
    );
    const bucketRef = explicitApplication ? bucketRefOrOptions : applicationIdOrBucketRef;
    const options = explicitApplication ? legacyOptions : bucketRefOrOptions;
    return this.httpClient.delete(
      `/applications/${applicationId}/storage/buckets/${encodeStorageBucketReference(bucketRef)}`,
      { query: { environment: options?.environment } }
    );
  }
}

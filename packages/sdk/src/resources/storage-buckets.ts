import type { Paginated } from '../http-client';
import { BaseResource } from './base-resource';

/** A storage bucket belonging to an application. Buckets hold objects (files). */
export interface StorageBucket {
  /** Unique identifier (UUID). */
  id: string;
  /** The application this bucket belongs to. */
  applicationId: string;
  /** Human-readable bucket name. */
  name: string;
  /** Globally unique, URL-safe bucket label. */
  slug: string;
  /** `"public"` buckets serve objects without authentication; `"private"` buckets require signed URLs. */
  visibility: 'public' | 'private';
  /** The underlying object-storage provider (e.g. `"backblaze-b2"`). */
  provider: string;
  /** Provider-internal bucket identifier, if assigned. */
  providerBucketId: string | null;
  /** Provider-internal bucket name, if assigned. */
  providerBucketName: string | null;
  /** The CDN hostname used for serving objects (e.g. `"cdn.example.com"`). */
  cdnHostname: string;
  /** The environment this bucket is scoped to. */
  environmentId: string;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 last-updated timestamp. */
  updatedAt: string;
}

/** Input for creating a new storage bucket. */
export interface CreateStorageBucketInput {
  /** Human-readable name for the bucket. */
  name: string;
  /** Bucket visibility. Defaults to `"private"`. */
  visibility?: 'public' | 'private';
  /** The environment to scope this bucket to. */
  environmentId?: string;
}

/**
 * Manage storage buckets for an application.
 * Accessed via `client.applications.storage.buckets`.
 *
 * @example
 * ```ts
 * // Create a public bucket
 * const bucket = await client.applications.storage.buckets.create('app-id', {
 *   name: 'User Uploads',
 *   visibility: 'public',
 * });
 *
 * // List all buckets
 * const { items } = await client.applications.storage.buckets.list('app-id');
 * ```
 */
export class StorageBucketsResource extends BaseResource {
  /**
   * List all storage buckets for an application.
   *
   * @param applicationId - The application ID (UUID).
   * @returns A paginated list of storage buckets.
   *
   * @example
   * ```ts
   * const { items, total } = await client.applications.storage.buckets.list('app-id');
   * console.log(`${total} buckets found`);
   * ```
   */
  async list(applicationId: string): Promise<Paginated<StorageBucket>> {
    return this.httpClient.get(`/applications/${applicationId}/storage/buckets`);
  }

  /**
   * Create a new storage bucket.
   *
   * @param applicationId - The application ID (UUID).
   * @param data - Bucket name, visibility, and optional environment.
   * @returns The newly created bucket.
   *
   * @example
   * ```ts
   * const bucket = await client.applications.storage.buckets.create('app-id', {
   *   name: 'Assets',
   *   visibility: 'public',
   * });
   * console.log(`Bucket CDN: https://${bucket.cdnHostname}`);
   * ```
   */
  async create(applicationId: string, data: CreateStorageBucketInput): Promise<StorageBucket> {
    return this.httpClient.post(`/applications/${applicationId}/storage/buckets`, data);
  }

  /**
   * Get a storage bucket by ID.
   *
   * @param applicationId - The application ID (UUID).
   * @param bucketId - The bucket ID (UUID).
   * @returns The bucket details.
   *
   * @example
   * ```ts
   * const bucket = await client.applications.storage.buckets.get('app-id', 'bucket-id');
   * console.log(`${bucket.name} (${bucket.visibility})`);
   * ```
   */
  async get(applicationId: string, bucketId: string): Promise<StorageBucket> {
    return this.httpClient.get(`/applications/${applicationId}/storage/buckets/${bucketId}`);
  }

  /**
   * Permanently delete a storage bucket and all its objects.
   *
   * @param applicationId - The application ID (UUID).
   * @param bucketId - The bucket ID (UUID).
   *
   * @example
   * ```ts
   * await client.applications.storage.buckets.delete('app-id', 'bucket-id');
   * ```
   */
  async delete(applicationId: string, bucketId: string): Promise<void> {
    return this.httpClient.delete(`/applications/${applicationId}/storage/buckets/${bucketId}`);
  }
}

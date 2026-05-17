import type { HttpClient } from '../http-client';
import { StorageBucketsResource } from './storage-buckets';
import { StorageObjectsResource } from './storage-objects';
import { StorageUploadSessionsResource } from './storage-upload-sessions';

/**
 * Namespace for all storage operations on an application. Provides access to
 * bucket management, object listing/deletion, and file uploads.
 *
 * Accessed via `client.applications.storage`.
 *
 * @example
 * ```ts
 * // Create a bucket
 * const bucket = await client.applications.storage.buckets.create('app-id', {
 *   name: 'User Uploads',
 *   visibility: 'public',
 * });
 *
 * // Upload a file
 * const { url } = await client.applications.storage.uploadSessions.upload(
 *   'app-id', bucket.id, 'photos/cat.jpg',
 *   readFileSync('./cat.jpg'),
 *   { contentType: 'image/jpeg' },
 * );
 *
 * // List objects
 * const { items } = await client.applications.storage.objects.list('app-id', bucket.id);
 * ```
 */
export class ApplicationStorageResource {
  /** Create, list, get, and delete storage buckets. */
  readonly buckets: StorageBucketsResource;
  /** List, get, delete objects, and generate access URLs. */
  readonly objects: StorageObjectsResource;
  /** Create upload sessions and upload files using the TUS resumable upload protocol. */
  readonly uploadSessions: StorageUploadSessionsResource;

  constructor(httpClient: HttpClient) {
    this.buckets = new StorageBucketsResource(httpClient);
    this.objects = new StorageObjectsResource(httpClient);
    this.uploadSessions = new StorageUploadSessionsResource(httpClient);
  }
}

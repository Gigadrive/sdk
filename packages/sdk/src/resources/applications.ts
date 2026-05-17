import type { Paginated } from '../http-client';
import { ApplicationEnvVarsResource } from './application-env-vars';
import { ApplicationStorageResource } from './application-storage';
import { BaseResource } from './base-resource';
import type { Organization } from './organizations';

/** A Gigadrive Network application, belonging to an {@link Organization}. */
export interface Application {
  /** Unique identifier (UUID). */
  id: string;
  /** The organization this application belongs to. */
  organization: Organization;
  /** Display name of the application. */
  name: string;
  /** Avatar / logo URL. */
  imageUrl: string;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 last-updated timestamp. */
  updatedAt: string;
}

/**
 * Manage applications. Accessed via {@link GigadriveClient.applications}.
 *
 * @example
 * ```ts
 * const { items: apps } = await client.applications.list();
 * console.log(apps.map((a) => `${a.name} (${a.organization.name})`));
 * ```
 */
export class ApplicationsResource extends BaseResource {
  /**
   * Manage environment variables scoped to an application.
   *
   * @example
   * ```ts
   * await client.applications.envVars.create('app-id', {
   *   key: 'DATABASE_URL',
   *   value: 'postgres://...',
   *   sensitive: true,
   * });
   * ```
   */
  readonly envVars: ApplicationEnvVarsResource;

  /**
   * Manage storage buckets, objects, and file uploads for an application.
   *
   * @example
   * ```ts
   * // Upload a file
   * const { url } = await client.applications.storage.uploadSessions.upload(
   *   'app-id', 'bucket-id', 'images/logo.png',
   *   fileData,
   *   { contentType: 'image/png' },
   * );
   *
   * // List objects in a bucket
   * const { items } = await client.applications.storage.objects.list('app-id', 'bucket-id');
   * ```
   */
  readonly storage: ApplicationStorageResource;

  constructor(...args: ConstructorParameters<typeof BaseResource>) {
    super(...args);
    this.envVars = new ApplicationEnvVarsResource(this.httpClient);
    this.storage = new ApplicationStorageResource(this.httpClient);
  }

  /**
   * List all applications the authenticated actor has access to.
   *
   * Requires the `network:applications:read` scope.
   *
   * @returns A paginated list of applications.
   *
   * @example
   * ```ts
   * const { items, total } = await client.applications.list();
   * console.log(`Found ${total} applications`);
   * ```
   */
  async list(): Promise<Paginated<Application>> {
    return this.httpClient.get('/applications');
  }
}

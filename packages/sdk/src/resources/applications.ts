import type { ListQuery, Paginated } from '../http-client';
import { ApplicationEnvVarsResource } from './application-env-vars';
import { ApplicationRequestsResource } from './application-requests';
import { ApplicationStorageResource } from './application-storage';
import { BaseResource } from './base-resource';
import type { ApplicationHostnameList } from './hostnames';
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

/** Query filters for listing applications. */
export interface ListApplicationsQuery extends ListQuery {
  /** Only return applications belonging to this organization. */
  organizationId?: string;
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
   * const { url } = await client.applications.storage.upload({
   *   applicationId: 'app-id',
   *   bucketId: 'bucket-id',
   *   key: 'images/logo.png',
   *   data: fileData,
   * });
   *
   * // List objects in a bucket
   * const { items } = await client.applications.storage.objects.list('app-id', 'bucket-id');
   * ```
   */
  readonly storage: ApplicationStorageResource;

  /**
   * Read observed traffic (request logs) for an application.
   *
   * @example
   * ```ts
   * const { items } = await client.applications.requests.list('app-id', { statusFamily: 5 });
   * ```
   */
  readonly requests: ApplicationRequestsResource;

  constructor(...args: ConstructorParameters<typeof BaseResource>) {
    super(...args);
    this.envVars = new ApplicationEnvVarsResource(this.httpClient);
    this.storage = new ApplicationStorageResource(this.httpClient);
    this.requests = new ApplicationRequestsResource(this.httpClient);
  }

  /**
   * List applications the authenticated actor has access to.
   *
   * Requires the `network:applications:read` scope.
   *
   * @param query - Optional organization filter and pagination.
   * @returns A paginated list of applications.
   *
   * @example
   * ```ts
   * const { items, total } = await client.applications.list({ organizationId: 'org-id' });
   * console.log(`Found ${total} applications`);
   * ```
   */
  async list(query?: ListApplicationsQuery): Promise<Paginated<Application>> {
    return this.httpClient.get('/applications', {
      query: query as Record<string, string | number | undefined> | undefined,
    });
  }

  /**
   * List the `*.gigadrive.app` hostnames for an application (production alias
   * and per-branch aliases).
   *
   * @param applicationId - The application ID (UUID).
   * @returns The hostnames plus the production hostname `label`.
   *
   * @example
   * ```ts
   * const { items, label } = await client.applications.hostnames('app-id');
   * console.log(`Production: ${label}.gigadrive.app`);
   * ```
   */
  async hostnames(applicationId: string): Promise<ApplicationHostnameList> {
    return this.httpClient.get(`/applications/${applicationId}/hostnames`);
  }
}

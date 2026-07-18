import type { ListQuery, Paginated } from '../http-client';
import { ApplicationEnvVarsResource } from './application-env-vars';
import { ApplicationRequestsResource } from './application-requests';
import { ApplicationStorageResource } from './application-storage';
import { BaseResource } from './base-resource';
import type { ApplicationHostnameList, HostnameAvailability, SetProductionHostnameResult } from './hostnames';
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

/** Input accepted when creating a Gigadrive Network application. */
export interface CreateApplicationInput {
  /** Organization that will own the application. */
  organizationId: string;
  /** Display name. Surrounding whitespace is removed by the API. */
  name: string;
  /** Optional lowercase slug. Generated from {@link name} when omitted. */
  slug?: string;
  /**
   * Project directory relative to the repository root. The API normalizes
   * redundant separators and rejects absolute paths and traversal segments.
   */
  rootDirectory?: string;
}

/**
 * Application creation result used to start the first deployment without an
 * additional lookup.
 */
export interface CreatedApplication {
  /** Stable application UUID. */
  id: string;
  /** Owning organization UUID. */
  organizationId: string;
  /** Normalized display name. */
  name: string;
  /** Generated or caller-supplied application slug. */
  slug: string;
  /** Application icon URL. */
  imageUrl: string;
  /** Normalized project directory, or `null` for the repository root. */
  rootDirectory: string | null;
  /** Production environment slug to use for the first deployment. */
  defaultEnvironmentSlug: string;
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
   * Creates an application with production and preview environments.
   *
   * Requires the `network:applications:write` scope and access to the owning
   * organization. Application-, deployment-, and function-scoped tokens cannot
   * create applications.
   *
   * @param input - Ownership, display name, and optional repository layout.
   * @returns The persisted application plus the default production environment
   * slug, ready for an immediate deployment request.
   *
   * @example
   * ```ts
   * const app = await client.applications.create({
   *   organizationId: 'org-id',
   *   name: 'Next.js Storefront',
   * });
   * console.log(app.id, app.defaultEnvironmentSlug);
   * ```
   */
  async create(input: CreateApplicationInput): Promise<CreatedApplication> {
    return this.httpClient.post('/applications', input);
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

  /**
   * Check whether a candidate production hostname label is allowed and globally
   * available before setting it with {@link setProductionHostname}.
   *
   * Requires the `network:applications:read` scope.
   *
   * @param applicationId - The application ID (UUID).
   * @param label - The candidate production hostname label (e.g. `"my-app"`).
   * @returns Whether the label is available, plus a `reason` when it is not.
   *
   * @example
   * ```ts
   * const { available, reason } = await client.applications.checkHostnameAvailability('app-id', 'my-app');
   * if (!available) console.log(`Unavailable: ${reason}`);
   * ```
   */
  async checkHostnameAvailability(applicationId: string, label: string): Promise<HostnameAvailability> {
    return this.httpClient.get(`/applications/${applicationId}/hostname/availability`, {
      query: { label },
    });
  }

  /**
   * Set the application's production hostname. The production alias
   * `{label}.gigadrive.app` is re-pointed to the latest production deployment.
   *
   * Requires the `network:applications:write` scope. Deployment- and
   * function-scoped tokens cannot change the production hostname.
   *
   * @param applicationId - The application ID (UUID).
   * @param label - The production hostname label (e.g. `"my-app"`). It is
   *   normalized (slugified) server-side.
   * @returns The saved label, the resulting hostname, and whether it is live yet.
   *
   * @example
   * ```ts
   * const { hostname, live } = await client.applications.setProductionHostname('app-id', 'my-app');
   * console.log(live ? `Live at ${hostname}` : `Reserved ${hostname} (deploy to go live)`);
   * ```
   */
  async setProductionHostname(applicationId: string, label: string): Promise<SetProductionHostnameResult> {
    return this.httpClient.put(`/applications/${applicationId}/hostname`, { label });
  }
}

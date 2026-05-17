import type { Paginated } from '../http-client';
import { BaseResource } from './base-resource';
import { OrganizationEnvVarsResource } from './organization-env-vars';

/** A Gigadrive Network organization. */
export interface Organization {
  /** Unique identifier (UUID). */
  id: string;
  /** Display name of the organization. */
  name: string;
  /** URL-safe slug (e.g. `gigadrive`). */
  slug: string;
  /** Avatar / logo URL. */
  imageUrl: string;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 last-updated timestamp. */
  updatedAt: string;
}

/**
 * Manage organizations. Accessed via {@link GigadriveClient.organizations}.
 *
 * @example
 * ```ts
 * const { items: orgs } = await client.organizations.list();
 * console.log(orgs.map((o) => o.name));
 * ```
 */
export class OrganizationsResource extends BaseResource {
  /**
   * Manage environment variables scoped to an organization.
   *
   * @example
   * ```ts
   * // List all env vars for an organization
   * const { items } = await client.organizations.envVars.list('org-id');
   *
   * // Create a new env var
   * await client.organizations.envVars.create('org-id', {
   *   key: 'ANALYTICS_KEY',
   *   value: 'ak_live_...',
   *   sensitive: true,
   * });
   * ```
   */
  readonly envVars: OrganizationEnvVarsResource;

  constructor(...args: ConstructorParameters<typeof BaseResource>) {
    super(...args);
    this.envVars = new OrganizationEnvVarsResource(this.httpClient);
  }

  /**
   * List all organizations the authenticated actor has access to.
   *
   * Requires the `network:organizations:read` scope.
   *
   * @returns A paginated list of organizations.
   *
   * @example
   * ```ts
   * const { items, total } = await client.organizations.list();
   * console.log(`Found ${total} organizations`);
   * ```
   */
  async list(): Promise<Paginated<Organization>> {
    return this.httpClient.get('/organizations');
  }
}

import type { ListQuery, Paginated } from '../http-client';
import { BaseResource } from './base-resource';
import { OrganizationAiGatewayResource } from './organization-ai-gateway';
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

  /**
   * AI Gateway governance for an organization: usage analytics, budgets, and
   * model/provider policies.
   *
   * @example
   * ```ts
   * const usage = await client.organizations.aiGateway.usage.summary('org-id', { from: '2026-06-01' });
   * console.log(usage.summary.totalTokens);
   * ```
   */
  readonly aiGateway: OrganizationAiGatewayResource;

  constructor(...args: ConstructorParameters<typeof BaseResource>) {
    super(...args);
    this.envVars = new OrganizationEnvVarsResource(this.httpClient);
    this.aiGateway = new OrganizationAiGatewayResource(this.httpClient);
  }

  /**
   * List organizations the authenticated actor has access to.
   *
   * @param query - Optional pagination.
   * @returns A paginated list of organizations.
   *
   * @example
   * ```ts
   * const { items, total } = await client.organizations.list();
   * console.log(`Found ${total} organizations`);
   * ```
   */
  async list(query?: ListQuery): Promise<Paginated<Organization>> {
    return this.httpClient.get('/organizations', {
      query: query as Record<string, string | number | undefined> | undefined,
    });
  }
}

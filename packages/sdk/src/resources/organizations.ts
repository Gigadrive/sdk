import type { ListQuery, Paginated } from '../http-client';
import { BaseResource } from './base-resource';
import { OrganizationAiGatewayResource } from './organization-ai-gateway';
import { OrganizationEnvVarsResource } from './organization-env-vars';
import { OrganizationMembersResource } from './organization-members';
import { OrganizationProductsResource } from './organization-products';

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

/** Input for creating an organization. */
export interface CreateOrganizationInput {
  /** Display name for the new organization. */
  name: string;
  /** Optional URL-safe slug. Generated from the name when omitted. */
  slug?: string;
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

  /**
   * List organization members and membership roles.
   *
   * @example
   * ```ts
   * const { items } = await client.organizations.members.list('org-id');
   * ```
   */
  readonly members: OrganizationMembersResource;

  /**
   * Inspect organization product entitlements. Read-only through the public
   * API — plan changes happen in Gigadrive product surfaces, not via the SDK.
   *
   * @example
   * ```ts
   * const check = await client.organizations.products.checkEntitlement('org-id', 'office');
   * ```
   */
  readonly products: OrganizationProductsResource;

  constructor(...args: ConstructorParameters<typeof BaseResource>) {
    super(...args);
    this.envVars = new OrganizationEnvVarsResource(this.httpClient);
    this.aiGateway = new OrganizationAiGatewayResource(this.httpClient);
    this.members = new OrganizationMembersResource(this.httpClient);
    this.products = new OrganizationProductsResource(this.httpClient);
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

  /**
   * Get a single organization by ID.
   *
   * @param organizationId - Organization to retrieve.
   * @returns The organization.
   *
   * @example
   * ```ts
   * const org = await client.organizations.get('org-id');
   * console.log(org.name, org.slug);
   * ```
   */
  async get(organizationId: string): Promise<Organization> {
    return this.httpClient.get(`/organizations/${organizationId}`);
  }

  /**
   * Create a new organization.
   *
   * Requires a user-backed token with the `platform:organizations:write` scope.
   * The authenticated user becomes the organization owner.
   *
   * @param input - Organization creation input.
   * @returns The created organization.
   *
   * @example
   * ```ts
   * const org = await client.organizations.create({ name: 'Acme Corp' });
   * console.log(org.id, org.slug);
   * ```
   */
  async create(input: CreateOrganizationInput): Promise<Organization> {
    return this.httpClient.post('/organizations', input);
  }
}

import type { Paginated } from '../http-client';
import { BaseResource } from './base-resource';

/** Product access mode from the code-defined product registry. */
export type ProductAccessMode = 'organization' | 'user';

/** Fallback access policy when no explicit entitlement override exists. */
export type ProductDefaultAccessPolicy = 'granted' | 'explicit_entitlement_required';

/** Lifecycle status of an explicit product entitlement override. */
export type ProductEntitlementStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

/** Lifecycle status of a local organization product subscription. */
export type ProductSubscriptionStatus = 'ACTIVE' | 'CANCELED';

/** Whether effective access was resolved from an override or the registry default. */
export type ProductAccessResolutionSource = 'explicit' | 'default';

/** A plan defined for a product in the product registry. */
export interface ProductPlan {
  /** Stable plan slug. */
  slug: string;
  /** Human-readable plan name. */
  displayName: string;
  /** Short description of the plan. */
  description: string;
}

/** Product metadata from the code-defined product registry. */
export interface ProductDefinition {
  /** Stable product slug (e.g. `network`, `office`). */
  slug: string;
  /** Human-readable product name. */
  displayName: string;
  /** Whether the product is granted to organizations or directly to users. */
  accessMode: ProductAccessMode;
  /** Fallback access policy when no explicit entitlement override exists. */
  defaultAccessPolicy: ProductDefaultAccessPolicy;
  /** Locally activatable plans for the product. */
  plans: ProductPlan[];
}

/** Explicit organization product entitlement override. */
export interface OrganizationProductEntitlement {
  /** Unique identifier (UUID). */
  id: string;
  /** Product slug this entitlement applies to. */
  product: string;
  /** Lifecycle status of the override. */
  status: ProductEntitlementStatus;
  /** User who last granted or updated the override, if known. */
  grantedByUserId: string | null;
  /** ISO 8601 timestamp when the entitlement was revoked, if revoked. */
  revokedAt: string | null;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 last-updated timestamp. */
  updatedAt: string;
}

/** Local organization product subscription / plan selection. */
export interface OrganizationProductSubscription {
  /** Unique identifier (UUID). */
  id: string;
  /** Product slug this subscription applies to. */
  product: string;
  /** Currently selected plan slug. */
  plan: string;
  /** Local subscription lifecycle status. */
  status: ProductSubscriptionStatus;
  /** User who activated the current plan, if known. */
  activatedByUserId: string | null;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 last-updated timestamp. */
  updatedAt: string;
}

/** Effective product access summary for an organization-scoped product. */
export interface OrganizationProductAccess {
  /** Product metadata from the registry. */
  product: ProductDefinition;
  /** Whether the organization currently has effective access. */
  hasAccess: boolean;
  /** Whether access was resolved from an explicit override or the default policy. */
  resolutionSource: ProductAccessResolutionSource;
  /** Explicit entitlement override when one exists. */
  explicitEntitlement: OrganizationProductEntitlement | null;
  /** Local product subscription when one exists. */
  subscription: OrganizationProductSubscription | null;
}

/** Compact yes/no entitlement check for an organization product. */
export interface OrganizationProductEntitlementCheck {
  /** Organization that was checked. */
  organizationId: string;
  /** Product slug that was checked. */
  product: string;
  /** Whether the organization currently has effective access. */
  hasAccess: boolean;
}

/**
 * Inspect organization product access / entitlements.
 *
 * Accessed via {@link OrganizationsResource.products}.
 *
 * Subscriptions are read-only through the public API — plan changes happen in
 * Gigadrive product surfaces, not via the SDK.
 *
 * @example
 * ```ts
 * const { items } = await client.organizations.products.list('org-id');
 * const check = await client.organizations.products.checkEntitlement('org-id', 'office');
 * console.log(check.hasAccess);
 * ```
 */
export class OrganizationProductsResource extends BaseResource {
  /**
   * List effective product access for every organization-scoped product.
   *
   * @param organizationId - Organization whose product access should be listed.
   * @returns A paginated list of product access summaries.
   *
   * @example
   * ```ts
   * const { items } = await client.organizations.products.list('org-id');
   * for (const item of items) {
   *   console.log(item.product.slug, item.hasAccess);
   * }
   * ```
   */
  async list(organizationId: string): Promise<Paginated<OrganizationProductAccess>> {
    return this.httpClient.get(`/organizations/${organizationId}/products`);
  }

  /**
   * Get effective access for one organization-scoped product.
   *
   * @param organizationId - Organization to inspect.
   * @param product - Product slug from the product registry.
   * @returns Product access summary including entitlement and subscription state.
   *
   * @example
   * ```ts
   * const access = await client.organizations.products.get('org-id', 'office');
   * console.log(access.hasAccess, access.subscription?.plan);
   * ```
   */
  async get(organizationId: string, product: string): Promise<OrganizationProductAccess> {
    return this.httpClient.get(`/organizations/${organizationId}/products/${product}`);
  }

  /**
   * Check whether an organization currently has access to a product.
   *
   * @param organizationId - Organization to check.
   * @param product - Product slug from the product registry.
   * @returns Compact entitlement check result.
   *
   * @example
   * ```ts
   * const { hasAccess } = await client.organizations.products.checkEntitlement('org-id', 'network');
   * ```
   */
  async checkEntitlement(organizationId: string, product: string): Promise<OrganizationProductEntitlementCheck> {
    return this.httpClient.get(`/organizations/${organizationId}/products/${product}/entitlement`);
  }
}

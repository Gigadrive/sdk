import type { Paginated } from '../http-client';
import { BaseResource } from './base-resource';

/** Organization membership role used for administration privileges. */
export type OrganizationMembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER';

/** A user membership in a Gigadrive organization. */
export interface OrganizationMember {
  /** Unique membership identifier (UUID). */
  membershipId: string;
  /** Organization that owns this membership. */
  organizationId: string;
  /** User who belongs to the organization. */
  userId: string;
  /** Email address of the organization member. */
  email: string;
  /** Given name of the organization member, or null when unset. */
  givenName: string | null;
  /** Family name of the organization member, or null when unset. */
  familyName: string | null;
  /** Avatar URL for the organization member, or null when unset. */
  imageUrl: string | null;
  /** Organization membership role. */
  role: OrganizationMembershipRole;
  /** ISO 8601 timestamp when the user joined the organization. */
  joinedAt: string;
}

/**
 * List organization members. Accessed via {@link OrganizationsResource.members}.
 *
 * @example
 * ```ts
 * const { items } = await client.organizations.members.list('org-id');
 * console.log(items.map((m) => `${m.email} (${m.role})`));
 * ```
 */
export class OrganizationMembersResource extends BaseResource {
  /**
   * List the users who belong to an organization.
   *
   * @param organizationId - Organization whose members should be listed.
   * @returns A paginated list of organization members.
   *
   * @example
   * ```ts
   * const { items, total } = await client.organizations.members.list('org-id');
   * console.log(`Found ${total} members`);
   * ```
   */
  async list(organizationId: string): Promise<Paginated<OrganizationMember>> {
    return this.httpClient.get(`/organizations/${organizationId}/members`);
  }
}

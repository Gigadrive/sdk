import type { ListQuery, Paginated } from '../http-client';
import { BaseResource } from './base-resource';
import type { CreateEnvVarInput, EnvVar, UpdateEnvVarInput } from './env-vars';

/**
 * Manage environment variables scoped to an organization.
 * Accessed via `client.organizations.envVars`.
 */
export class OrganizationEnvVarsResource extends BaseResource {
  /**
   * List all environment variables for an organization.
   *
   * @param organizationId - The organization ID (UUID).
   * @returns A paginated list of environment variables.
   *
   * @example
   * ```ts
   * const { items } = await client.organizations.envVars.list('org-id');
   * for (const v of items) {
   *   console.log(`${v.key}=${v.sensitive ? '***' : v.value}`);
   * }
   * ```
   */
  async list(organizationId: string, query?: ListQuery): Promise<Paginated<EnvVar>> {
    return this.httpClient.get(`/organizations/${organizationId}/env-vars`, {
      query: query as Record<string, string | number | undefined> | undefined,
    });
  }

  /**
   * Create a new environment variable for an organization.
   *
   * @param organizationId - The organization ID (UUID).
   * @param data - The variable key, value, and optional settings.
   * @returns The newly created environment variable.
   *
   * @example
   * ```ts
   * const envVar = await client.organizations.envVars.create('org-id', {
   *   key: 'STRIPE_SECRET',
   *   value: 'sk_live_...',
   *   sensitive: true,
   * });
   * ```
   */
  async create(organizationId: string, data: CreateEnvVarInput): Promise<EnvVar> {
    return this.httpClient.post(`/organizations/${organizationId}/env-vars`, data);
  }

  /**
   * Update an existing environment variable. Only the fields you provide
   * will be changed; omitted fields are left unchanged.
   *
   * @param organizationId - The organization ID (UUID).
   * @param envVarId - The environment variable ID (UUID).
   * @param data - The fields to update.
   * @returns The updated environment variable.
   *
   * @example
   * ```ts
   * await client.organizations.envVars.update('org-id', 'var-id', {
   *   value: 'new-value',
   * });
   * ```
   */
  async update(organizationId: string, envVarId: string, data: UpdateEnvVarInput): Promise<EnvVar> {
    return this.httpClient.patch(`/organizations/${organizationId}/env-vars/${envVarId}`, data);
  }

  /**
   * Permanently delete an environment variable.
   *
   * @param organizationId - The organization ID (UUID).
   * @param envVarId - The environment variable ID (UUID).
   *
   * @example
   * ```ts
   * await client.organizations.envVars.delete('org-id', 'var-id');
   * ```
   */
  async delete(organizationId: string, envVarId: string): Promise<void> {
    return this.httpClient.delete(`/organizations/${organizationId}/env-vars/${envVarId}`);
  }
}

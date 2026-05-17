import type { Paginated } from '../http-client';
import { BaseResource } from './base-resource';
import type { CreateEnvVarInput, EnvVar, UpdateEnvVarInput } from './env-vars';

/**
 * Manage environment variables scoped to an application.
 * Accessed via `client.applications.envVars`.
 */
export class ApplicationEnvVarsResource extends BaseResource {
  /**
   * List all environment variables for an application.
   *
   * @param applicationId - The application ID (UUID).
   * @returns A paginated list of environment variables.
   *
   * @example
   * ```ts
   * const { items } = await client.applications.envVars.list('app-id');
   * for (const v of items) {
   *   console.log(`${v.key}=${v.sensitive ? '***' : v.value}`);
   * }
   * ```
   */
  async list(applicationId: string): Promise<Paginated<EnvVar>> {
    return this.httpClient.get(`/applications/${applicationId}/env-vars`);
  }

  /**
   * Create a new environment variable for an application.
   *
   * @param applicationId - The application ID (UUID).
   * @param data - The variable key, value, and optional settings.
   * @returns The newly created environment variable.
   *
   * @example
   * ```ts
   * const envVar = await client.applications.envVars.create('app-id', {
   *   key: 'DATABASE_URL',
   *   value: 'postgres://...',
   *   sensitive: true,
   * });
   * ```
   */
  async create(applicationId: string, data: CreateEnvVarInput): Promise<EnvVar> {
    return this.httpClient.post(`/applications/${applicationId}/env-vars`, data);
  }

  /**
   * Update an existing environment variable. Only the fields you provide
   * will be changed; omitted fields are left unchanged.
   *
   * @param applicationId - The application ID (UUID).
   * @param envVarId - The environment variable ID (UUID).
   * @param data - The fields to update.
   * @returns The updated environment variable.
   *
   * @example
   * ```ts
   * await client.applications.envVars.update('app-id', 'var-id', {
   *   value: 'postgres://new-host/db',
   * });
   * ```
   */
  async update(applicationId: string, envVarId: string, data: UpdateEnvVarInput): Promise<EnvVar> {
    return this.httpClient.patch(`/applications/${applicationId}/env-vars/${envVarId}`, data);
  }

  /**
   * Permanently delete an environment variable.
   *
   * @param applicationId - The application ID (UUID).
   * @param envVarId - The environment variable ID (UUID).
   *
   * @example
   * ```ts
   * await client.applications.envVars.delete('app-id', 'var-id');
   * ```
   */
  async delete(applicationId: string, envVarId: string): Promise<void> {
    return this.httpClient.delete(`/applications/${applicationId}/env-vars/${envVarId}`);
  }
}

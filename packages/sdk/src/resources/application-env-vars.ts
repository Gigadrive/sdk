import type { ListQuery, Paginated } from '../http-client';
import { BaseResource } from './base-resource';
import type { CreateEnvVarInput, EnvVar, PullEnvVarsQuery, PullEnvVarsResult, UpdateEnvVarInput } from './env-vars';

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
  async list(applicationId: string, query?: ListQuery): Promise<Paginated<EnvVar>> {
    return this.httpClient.get(`/applications/${applicationId}/env-vars`, {
      query: query as Record<string, string | number | undefined> | undefined,
    });
  }

  /**
   * Pull the environment variables that apply to an application for local
   * development. Merges organization-wide, application-wide, and (optionally)
   * environment-specific overrides, returning only non-sensitive values — ready
   * to write to a local `.env` file.
   *
   * @param applicationId - The application ID (UUID).
   * @param query - Optional environment targeting.
   * @returns The resolved non-sensitive variables plus the count of omitted secrets.
   *
   * @example
   * ```ts
   * const { items } = await client.applications.envVars.pull('app-id');
   * const dotenv = items.map((v) => `${v.key}=${v.value}`).join('\n');
   * ```
   */
  async pull(applicationId: string, query?: PullEnvVarsQuery): Promise<PullEnvVarsResult> {
    return this.httpClient.get(`/applications/${applicationId}/env-vars/pull`, {
      query: query as Record<string, string | number | undefined> | undefined,
    });
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

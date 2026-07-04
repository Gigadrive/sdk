import type { Paginated } from '../http-client';
import { BaseResource } from './base-resource';

/** An application-scoped API key. The secret is never returned after creation. */
export interface ApiKey {
  /** Unique identifier (UUID). Used as the OAuth client ID. */
  id: string;
  /** Human-readable label. */
  name: string;
  /** Application this key is scoped to. */
  applicationId: string | null;
  /** API capability scopes granted to the key. */
  scopes: string[];
  /** ISO 8601 expiry, or `null` if the key never expires. */
  expiresAt: string | null;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 last-updated timestamp. */
  updatedAt: string;
}

/** Input for creating an application-scoped API key. */
export interface CreateApiKeyInput {
  /** Human-readable label for the key. */
  name: string;
  /** Application to scope the key to. The key can only act on this application. */
  applicationId: string;
  /**
   * API capability scopes to grant. Each must be a subset of your own access and
   * cannot include API key management. Defaults to a minimal read-only set.
   */
  scopes?: string[];
  /** Optional ISO 8601 expiry. Defaults to 90 days when omitted. */
  expiresAt?: string;
}

/**
 * The result of creating an API key. Includes the plaintext {@link secret},
 * which is returned only once and cannot be retrieved again.
 */
export interface CreateApiKeyResult extends ApiKey {
  /** The plaintext client secret. Store it now — it cannot be retrieved again. */
  secret: string;
}

/** Query for {@link ApiKeysResource.list}. */
export interface ListApiKeysQuery {
  /** Application whose keys should be listed. */
  applicationId: string;
}

/**
 * Manage application-scoped API keys. Accessed via {@link GigadriveClient.apiKeys}.
 *
 * @example
 * ```ts
 * const key = await client.apiKeys.create({ name: 'ci', applicationId: 'app-id' });
 * // Use key.id + key.secret as OAuth client credentials. Store the secret now.
 * ```
 */
export class ApiKeysResource extends BaseResource {
  /**
   * Provision a new application-scoped API key. The plaintext secret is returned
   * exactly once — store it immediately.
   *
   * @param data - The key name, target application, and optional scopes/expiry.
   * @returns The created key including its one-time plaintext secret.
   */
  async create(data: CreateApiKeyInput): Promise<CreateApiKeyResult> {
    return this.httpClient.post('/api-keys', data);
  }

  /**
   * List the API keys scoped to an application. Secrets are never returned.
   *
   * @param query - The application whose keys should be listed.
   * @returns A paginated list of API key metadata.
   */
  async list(query: ListApiKeysQuery): Promise<Paginated<ApiKey>> {
    return this.httpClient.get('/api-keys', {
      query: query as unknown as Record<string, string | number | undefined>,
    });
  }

  /**
   * Permanently revoke an API key.
   *
   * @param apiKeyId - The API key ID (UUID).
   */
  async delete(apiKeyId: string): Promise<void> {
    return this.httpClient.delete(`/api-keys/${apiKeyId}`);
  }
}

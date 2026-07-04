import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../http-client';
import { ApiKeysResource } from './api-keys';

const createMockHttpClient = (): HttpClient =>
  ({
    get: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    post: vi.fn().mockResolvedValue({ id: 'k1', secret: 'gdnet_secret_test' }),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
  }) as unknown as HttpClient;

describe('ApiKeysResource', () => {
  it('creates an application-scoped API key and returns the secret', async () => {
    const http = createMockHttpClient();
    const result = await new ApiKeysResource(http).create({
      name: 'ci',
      applicationId: 'app-1',
      scopes: ['network:env_vars:read'],
    });
    expect(http.post).toHaveBeenCalledWith('/api-keys', {
      name: 'ci',
      applicationId: 'app-1',
      scopes: ['network:env_vars:read'],
    });
    expect(result.secret).toBe('gdnet_secret_test');
  });

  it('lists API keys for an application', async () => {
    const http = createMockHttpClient();
    await new ApiKeysResource(http).list({ applicationId: 'app-1' });
    expect(http.get).toHaveBeenCalledWith('/api-keys', { query: { applicationId: 'app-1' } });
  });

  it('deletes an API key', async () => {
    const http = createMockHttpClient();
    await new ApiKeysResource(http).delete('k1');
    expect(http.delete).toHaveBeenCalledWith('/api-keys/k1');
  });
});

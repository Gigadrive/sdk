import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../http-client';
import { ApplicationEnvVarsResource } from './application-env-vars';

const createMockHttpClient = (): HttpClient =>
  ({
    get: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    post: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
  }) as unknown as HttpClient;

describe('ApplicationEnvVarsResource', () => {
  it('lists env vars', async () => {
    const http = createMockHttpClient();
    await new ApplicationEnvVarsResource(http).list('app-1');
    expect(http.get).toHaveBeenCalledWith('/applications/app-1/env-vars', { query: undefined });
  });

  it('lists env vars with pagination', async () => {
    const http = createMockHttpClient();
    await new ApplicationEnvVarsResource(http).list('app-1', { perPage: 25 });
    expect(http.get).toHaveBeenCalledWith('/applications/app-1/env-vars', { query: { perPage: 25 } });
  });

  it('creates an env var', async () => {
    const http = createMockHttpClient();
    await new ApplicationEnvVarsResource(http).create('app-1', { key: 'K', value: 'V', sensitive: true });
    expect(http.post).toHaveBeenCalledWith('/applications/app-1/env-vars', { key: 'K', value: 'V', sensitive: true });
  });

  it('updates an env var with PATCH', async () => {
    const http = createMockHttpClient();
    await new ApplicationEnvVarsResource(http).update('app-1', 'var-1', { value: 'new' });
    expect(http.patch).toHaveBeenCalledWith('/applications/app-1/env-vars/var-1', { value: 'new' });
  });

  it('deletes an env var', async () => {
    const http = createMockHttpClient();
    await new ApplicationEnvVarsResource(http).delete('app-1', 'var-1');
    expect(http.delete).toHaveBeenCalledWith('/applications/app-1/env-vars/var-1');
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../http-client';
import { OrganizationsResource } from './organizations';

const createMockHttpClient = (): HttpClient =>
  ({
    get: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    post: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
  }) as unknown as HttpClient;

describe('OrganizationsResource', () => {
  it('should list organizations', async () => {
    const http = createMockHttpClient();
    const resource = new OrganizationsResource(http);

    await resource.list();
    expect(http.get).toHaveBeenCalledWith('/organizations');
  });
});

describe('OrganizationEnvVarsResource', () => {
  it('should list env vars', async () => {
    const http = createMockHttpClient();
    const resource = new OrganizationsResource(http);

    await resource.envVars.list('org-1');
    expect(http.get).toHaveBeenCalledWith('/organizations/org-1/env-vars');
  });

  it('should create env var', async () => {
    const http = createMockHttpClient();
    const resource = new OrganizationsResource(http);

    await resource.envVars.create('org-1', { key: 'FOO', value: 'bar' });
    expect(http.post).toHaveBeenCalledWith('/organizations/org-1/env-vars', { key: 'FOO', value: 'bar' });
  });

  it('should update env var', async () => {
    const http = createMockHttpClient();
    const resource = new OrganizationsResource(http);

    await resource.envVars.update('org-1', 'var-1', { value: 'new' });
    expect(http.patch).toHaveBeenCalledWith('/organizations/org-1/env-vars/var-1', { value: 'new' });
  });

  it('should delete env var', async () => {
    const http = createMockHttpClient();
    const resource = new OrganizationsResource(http);

    await resource.envVars.delete('org-1', 'var-1');
    expect(http.delete).toHaveBeenCalledWith('/organizations/org-1/env-vars/var-1');
  });
});

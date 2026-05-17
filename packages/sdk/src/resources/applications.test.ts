import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../http-client';
import { ApplicationsResource } from './applications';

const createMockHttpClient = (): HttpClient =>
  ({
    get: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    post: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
  }) as unknown as HttpClient;

describe('ApplicationsResource', () => {
  it('should list applications', async () => {
    const http = createMockHttpClient();
    const resource = new ApplicationsResource(http);

    await resource.list();
    expect(http.get).toHaveBeenCalledWith('/applications');
  });

  it('should expose envVars sub-resource', async () => {
    const http = createMockHttpClient();
    const resource = new ApplicationsResource(http);

    await resource.envVars.list('app-1');
    expect(http.get).toHaveBeenCalledWith('/applications/app-1/env-vars');
  });

  it('should expose storage sub-resources', () => {
    const http = createMockHttpClient();
    const resource = new ApplicationsResource(http);

    expect(resource.storage.buckets).toBeDefined();
    expect(resource.storage.objects).toBeDefined();
    expect(resource.storage.uploadSessions).toBeDefined();
  });
});

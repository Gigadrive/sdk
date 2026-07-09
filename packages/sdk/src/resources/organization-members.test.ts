import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../http-client';
import { OrganizationMembersResource } from './organization-members';

const createMockHttpClient = (): HttpClient =>
  ({
    get: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    post: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
  }) as unknown as HttpClient;

describe('OrganizationMembersResource', () => {
  it('should list organization members', async () => {
    const http = createMockHttpClient();
    const resource = new OrganizationMembersResource(http);

    await resource.list('org-1');
    expect(http.get).toHaveBeenCalledWith('/organizations/org-1/members', { query: undefined });
  });

  it('should forward pagination query when listing members', async () => {
    const http = createMockHttpClient();
    const resource = new OrganizationMembersResource(http);

    await resource.list('org-1', { page: 2, perPage: 10 });
    expect(http.get).toHaveBeenCalledWith('/organizations/org-1/members', { query: { page: 2, perPage: 10 } });
  });
});

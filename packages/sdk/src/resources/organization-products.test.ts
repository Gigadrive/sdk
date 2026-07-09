import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../http-client';
import { OrganizationProductsResource } from './organization-products';

const createMockHttpClient = (): HttpClient =>
  ({
    get: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    post: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
  }) as unknown as HttpClient;

describe('OrganizationProductsResource', () => {
  it('should list organization products', async () => {
    const http = createMockHttpClient();
    const resource = new OrganizationProductsResource(http);

    await resource.list('org-1');
    expect(http.get).toHaveBeenCalledWith('/organizations/org-1/products', { query: undefined });
  });

  it('should forward pagination query when listing products', async () => {
    const http = createMockHttpClient();
    const resource = new OrganizationProductsResource(http);

    await resource.list('org-1', { page: 3, perPage: 5 });
    expect(http.get).toHaveBeenCalledWith('/organizations/org-1/products', { query: { page: 3, perPage: 5 } });
  });

  it('should get a single organization product', async () => {
    const http = createMockHttpClient();
    const resource = new OrganizationProductsResource(http);

    await resource.get('org-1', 'office');
    expect(http.get).toHaveBeenCalledWith('/organizations/org-1/products/office');
  });

  it('should check organization product entitlement', async () => {
    const http = createMockHttpClient();
    const resource = new OrganizationProductsResource(http);

    await resource.checkEntitlement('org-1', 'network');
    expect(http.get).toHaveBeenCalledWith('/organizations/org-1/products/network/entitlement');
  });
});

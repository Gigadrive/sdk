import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../http-client';
import { ApplicationRequestsResource } from './application-requests';

const createMockHttpClient = (): HttpClient =>
  ({ get: vi.fn().mockResolvedValue({ items: [], total: 0 }) }) as unknown as HttpClient;

describe('ApplicationRequestsResource', () => {
  it('lists requests with filters', async () => {
    const http = createMockHttpClient();
    await new ApplicationRequestsResource(http).list('app-1', { statusFamily: 5, method: 'GET', cacheHit: true });
    expect(http.get).toHaveBeenCalledWith('/applications/app-1/requests', {
      query: { statusFamily: 5, method: 'GET', cacheHit: true },
    });
  });

  it('lists requests without filters', async () => {
    const http = createMockHttpClient();
    await new ApplicationRequestsResource(http).list('app-1');
    expect(http.get).toHaveBeenCalledWith('/applications/app-1/requests', { query: undefined });
  });

  it('gets a single request', async () => {
    const http = createMockHttpClient();
    await new ApplicationRequestsResource(http).get('app-1', 'req-1');
    expect(http.get).toHaveBeenCalledWith('/applications/app-1/requests/req-1');
  });
});

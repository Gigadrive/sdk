import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GigadriveClient } from './client';
import { AuthenticationError } from './errors';

const mockFetch = vi.fn<typeof globalThis.fetch>();

describe('GigadriveClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should construct with explicit bearer token', () => {
    const client = new GigadriveClient({ bearerToken: 'my-token', fetch: mockFetch });

    expect(client.organizations).toBeDefined();
    expect(client.applications).toBeDefined();
    expect(client.deployments).toBeDefined();
    expect(client.aiGateway).toBeDefined();
  });

  it('should construct with explicit client credentials', () => {
    const client = new GigadriveClient({ clientId: 'id', clientSecret: 'secret', fetch: mockFetch });

    expect(client.organizations).toBeDefined();
  });

  it('should construct with env var credentials', () => {
    process.env.GIGADRIVE_BEARER_TOKEN = 'env-token';
    const client = new GigadriveClient({ fetch: mockFetch });

    expect(client.organizations).toBeDefined();
  });

  it('should throw AuthenticationError when no credentials provided', () => {
    delete process.env.GIGADRIVE_BEARER_TOKEN;
    delete process.env.GIGADRIVE_CLIENT_ID;
    delete process.env.GIGADRIVE_CLIENT_SECRET;
    delete process.env.GIGADRIVE_REFRESH_TOKEN;

    expect(() => new GigadriveClient({ fetch: mockFetch })).toThrow(AuthenticationError);
  });

  it('should expose all resource namespaces', () => {
    const client = new GigadriveClient({ bearerToken: 'token', fetch: mockFetch });

    expect(client.organizations).toBeDefined();
    expect(client.organizations.envVars).toBeDefined();
    expect(client.applications).toBeDefined();
    expect(client.applications.envVars).toBeDefined();
    expect(client.applications.storage).toBeDefined();
    expect(client.applications.storage.buckets).toBeDefined();
    expect(client.applications.storage.objects).toBeDefined();
    expect(client.applications.storage.uploadSessions).toBeDefined();
    expect(client.deployments).toBeDefined();
    expect(client.aiGateway).toBeDefined();
  });

  it('should use custom base URL', async () => {
    const client = new GigadriveClient({
      bearerToken: 'token',
      baseUrl: 'https://custom.api.com',
      fetch: mockFetch,
    });

    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 }));

    await client.organizations.list();

    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toBe('https://custom.api.com/organizations');
  });
});

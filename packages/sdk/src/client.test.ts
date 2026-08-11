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
    expect(client.storage).toBe(client.applications.storage);
    expect(client.applications.storage.buckets).toBeDefined();
    expect(client.applications.storage.objects).toBeDefined();
    expect(client.applications.storage.uploadSessions).toBeDefined();
    expect(client.applications.storage.trash).toBeDefined();
    expect(client.deployments).toBeDefined();
    expect(client.aiGateway).toBeDefined();
  });

  it('reads the default storage application from the workload environment', async () => {
    process.env.GIGADRIVE_APPLICATION_ID = 'workload-app';
    const client = new GigadriveClient({ bearerToken: 'token', fetch: mockFetch });
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ items: [], total: 0, commonPrefixes: [] })));

    await client.storage.objects.list('assets');

    expect(mockFetch.mock.calls[0]?.[0]).toBe(
      'https://api.gigadrive.network/applications/workload-app/storage/buckets/assets/objects'
    );
  });

  it('prefers explicit client application configuration over the workload environment', async () => {
    process.env.GIGADRIVE_APPLICATION_ID = 'workload-app';
    const client = new GigadriveClient({
      bearerToken: 'token',
      applicationId: 'configured-app',
      fetch: mockFetch,
    });
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ items: [], total: 0, commonPrefixes: [] })));

    await client.storage.objects.list('assets');

    expect(mockFetch.mock.calls[0]?.[0]).toBe(
      'https://api.gigadrive.network/applications/configured-app/storage/buckets/assets/objects'
    );
  });

  it('prefers a legacy overload application ID over configured context', async () => {
    const client = new GigadriveClient({
      bearerToken: 'token',
      applicationId: 'configured-app',
      fetch: mockFetch,
    });
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ items: [], total: 0, commonPrefixes: [] })));

    await client.storage.objects.list('explicit-app', 'assets', { environment: 'production' });

    expect(mockFetch.mock.calls[0]?.[0]).toBe(
      'https://api.gigadrive.network/applications/explicit-app/storage/buckets/assets/objects?environment=production'
    );
  });

  it('should expose the newer sub-resources and high-level helpers', () => {
    const client = new GigadriveClient({ bearerToken: 'token', fetch: mockFetch });

    expect(client.organizations.aiGateway).toBeDefined();
    expect(client.organizations.aiGateway.usage).toBeDefined();
    expect(client.organizations.aiGateway.budgets).toBeDefined();
    expect(client.organizations.aiGateway.policies).toBeDefined();
    expect(client.applications.requests).toBeDefined();
    expect(typeof client.applications.storage.upload).toBe('function');
    expect(typeof client.applications.storage.uploadBatch).toBe('function');
    expect(typeof client.aiGateway.chatCompletionsStream).toBe('function');
    expect(client.aiGateway.audio).toBeDefined();
    expect(client.aiGateway.videos).toBeDefined();
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

import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../http-client';
import { OrganizationAiGatewayResource } from './organization-ai-gateway';

const createMockHttpClient = (overrides: Partial<Record<string, unknown>> = {}): HttpClient =>
  ({
    get: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    requestStream: vi.fn(),
    ...overrides,
  }) as unknown as HttpClient;

describe('OrganizationAiGatewayResource', () => {
  it('gets a usage summary', async () => {
    const http = createMockHttpClient();
    await new OrganizationAiGatewayResource(http).usage.summary('org-1', { from: '2026-06-01' });
    expect(http.get).toHaveBeenCalledWith('/organizations/org-1/ai-gateway/usage/summary', {
      query: { from: '2026-06-01' },
    });
  });

  it('replaces budgets with PUT', async () => {
    const http = createMockHttpClient();
    await new OrganizationAiGatewayResource(http).budgets.replace('org-1', []);
    expect(http.put).toHaveBeenCalledWith('/organizations/org-1/ai-gateway/budgets', { budgets: [] });
  });

  it('unwraps the policy from the response', async () => {
    const http = createMockHttpClient({ get: vi.fn().mockResolvedValue({ policy: { id: 'pol-1' } }) });
    const policy = await new OrganizationAiGatewayResource(http).policies.get('org-1');
    expect(policy).toEqual({ id: 'pol-1' });
    expect(http.get).toHaveBeenCalledWith('/organizations/org-1/ai-gateway/policies', {
      query: { applicationId: undefined },
    });
  });

  it('exports usage as CSV text', async () => {
    const http = createMockHttpClient({ requestStream: vi.fn().mockResolvedValue(new Response('a,b\n1,2')) });
    const csv = await new OrganizationAiGatewayResource(http).usage.export('org-1');
    expect(csv).toBe('a,b\n1,2');
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../http-client';
import {
  ApplicationDomainsResource,
  DomainNotActiveError,
  OrganizationDomainsResource,
  type CustomDomain,
  type CustomDomainState,
} from './domains';

const createMockHttpClient = (): HttpClient =>
  ({
    get: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    post: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
  }) as unknown as HttpClient;

const domain = (state: CustomDomainState, overrides: Partial<CustomDomain> = {}): CustomDomain => ({
  id: 'dom-1',
  applicationId: 'app-1',
  hostname: 'shop.example.com',
  unicodeHostname: 'shop.example.com',
  apex: 'example.com',
  isApex: false,
  state,
  suspendedReason: null,
  target: {
    type: 'production',
    branchId: null,
    redirectTo: null,
    redirectStatusCode: null,
    redirectPreservePath: true,
  },
  primary: false,
  ownership: { name: 'example.com', verified: true },
  requiredRecords: [],
  error: null,
  certificate: { status: 'none', expiresAt: null },
  dns: null,
  nextCheckAt: null,
  activatedAt: null,
  createdAt: '2026-09-26T12:00:00.000Z',
  updatedAt: '2026-09-26T12:00:00.000Z',
  ...overrides,
});

describe('ApplicationDomainsResource', () => {
  it('calls the application domain endpoints', async () => {
    const http = createMockHttpClient();
    const domains = new ApplicationDomainsResource(http);

    await domains.list('app-1');
    await domains.add('app-1', { hostname: 'shop.example.com', target: { type: 'redirect', to: 'www.example.com' } });
    await domains.get('app-1', 'dom-1');
    await domains.update('app-1', 'dom-1', { primary: true });
    await domains.refresh('app-1', 'dom-1');
    await domains.remove('app-1', 'dom-1');
    await domains.claim('app-1', 'shop.example.com');

    expect(http.get).toHaveBeenCalledWith('/applications/app-1/domains');
    expect(http.post).toHaveBeenCalledWith('/applications/app-1/domains', {
      hostname: 'shop.example.com',
      target: { type: 'redirect', to: 'www.example.com' },
    });
    expect(http.get).toHaveBeenCalledWith('/applications/app-1/domains/dom-1');
    expect(http.patch).toHaveBeenCalledWith('/applications/app-1/domains/dom-1', { primary: true });
    expect(http.post).toHaveBeenCalledWith('/applications/app-1/domains/dom-1/refresh');
    expect(http.delete).toHaveBeenCalledWith('/applications/app-1/domains/dom-1');
    expect(http.post).toHaveBeenCalledWith('/applications/app-1/domains/claim', { hostname: 'shop.example.com' });
  });

  it('waits until the domain serves and reports each state once', async () => {
    const http = createMockHttpClient();
    vi.mocked(http.get)
      .mockResolvedValueOnce(domain('pending_dns'))
      .mockResolvedValueOnce(domain('pending_dns'))
      .mockResolvedValueOnce(domain('issuing_certificate'))
      .mockResolvedValueOnce(domain('active'));
    const states: CustomDomainState[] = [];

    const result = await new ApplicationDomainsResource(http).waitUntilActive('app-1', 'dom-1', {
      intervalMs: 1,
      onState: (current) => states.push(current.state),
    });

    expect(result.state).toBe('active');
    expect(states).toEqual(['pending_dns', 'issuing_certificate', 'active']);
  });

  it('stops with the problem when the domain fails', async () => {
    const http = createMockHttpClient();
    vi.mocked(http.get).mockResolvedValue(
      domain('failed', {
        error: { code: 'cert_blocked_caa', message: "The domain's CAA records do not allow Let's Encrypt." },
      })
    );

    const error = await new ApplicationDomainsResource(http)
      .waitUntilActive('app-1', 'dom-1', { intervalMs: 1 })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DomainNotActiveError);
    expect(error).toMatchObject({ reason: 'failed', domain: { state: 'failed' } });
    expect((error as Error).message).toContain('CAA');
  });

  it('times out while the domain is still pending', async () => {
    const http = createMockHttpClient();
    vi.mocked(http.get).mockResolvedValue(domain('pending_dns'));

    await expect(
      new ApplicationDomainsResource(http).waitUntilActive('app-1', 'dom-1', { intervalMs: 5, timeoutMs: 1 })
    ).rejects.toMatchObject({ name: 'DomainNotActiveError', reason: 'timeout' });
  });

  it('stops waiting when aborted', async () => {
    const http = createMockHttpClient();
    vi.mocked(http.get).mockResolvedValue(domain('pending_dns'));
    const controller = new AbortController();
    const waiting = new ApplicationDomainsResource(http).waitUntilActive('app-1', 'dom-1', {
      intervalMs: 60_000,
      signal: controller.signal,
    });

    controller.abort(new Error('cancelled'));

    await expect(waiting).rejects.toThrow('cancelled');
  });
});

describe('OrganizationDomainsResource', () => {
  it('calls the organization domain endpoints', async () => {
    const http = createMockHttpClient();
    const domains = new OrganizationDomainsResource(http);

    await domains.list('org-1');
    await domains.add('org-1', 'example.com');
    await domains.get('org-1', 'own-1');
    await domains.verify('org-1', 'own-1');
    await domains.remove('org-1', 'own-1');

    expect(http.get).toHaveBeenCalledWith('/organizations/org-1/domains');
    expect(http.post).toHaveBeenCalledWith('/organizations/org-1/domains', { name: 'example.com' });
    expect(http.get).toHaveBeenCalledWith('/organizations/org-1/domains/own-1');
    expect(http.post).toHaveBeenCalledWith('/organizations/org-1/domains/own-1/verify');
    expect(http.delete).toHaveBeenCalledWith('/organizations/org-1/domains/own-1');
  });
});

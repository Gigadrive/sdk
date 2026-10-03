import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../errors';
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

    expect(http.get).toHaveBeenCalledWith('/applications/app-1/domains', { query: undefined });
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

  it('passes pagination to the list endpoints', async () => {
    const http = createMockHttpClient();

    await new ApplicationDomainsResource(http).list('app-1', { cursor: 'next', perPage: 10 });
    await new OrganizationDomainsResource(http).list('org-1', { page: 2 });

    expect(http.get).toHaveBeenCalledWith('/applications/app-1/domains', { query: { cursor: 'next', perPage: 10 } });
    expect(http.get).toHaveBeenCalledWith('/organizations/org-1/domains', { query: { page: 2 } });
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

  it('stops when the domain is being removed', async () => {
    const http = createMockHttpClient();
    vi.mocked(http.get).mockResolvedValueOnce(domain('pending_dns')).mockResolvedValueOnce(domain('removing'));

    await expect(
      new ApplicationDomainsResource(http).waitUntilActive('app-1', 'dom-1', { intervalMs: 1 })
    ).rejects.toMatchObject({ name: 'DomainNotActiveError', reason: 'removing' });
  });

  it('reports a domain that disappears mid-wait as removed', async () => {
    const http = createMockHttpClient();
    vi.mocked(http.get)
      .mockResolvedValueOnce(domain('pending_dns'))
      .mockRejectedValueOnce(new ApiError('Not found', 404, 'not_found'));

    await expect(
      new ApplicationDomainsResource(http).waitUntilActive('app-1', 'dom-1', { intervalMs: 1 })
    ).rejects.toMatchObject({ name: 'DomainNotActiveError', reason: 'removing', domain: { state: 'pending_dns' } });
  });

  it('keeps polling through rate limits, server errors and network failures', async () => {
    const http = createMockHttpClient();
    vi.mocked(http.get)
      .mockResolvedValueOnce(domain('pending_dns'))
      .mockRejectedValueOnce(new ApiError('Too many requests', 429))
      .mockRejectedValueOnce(new ApiError('Bad gateway', 502))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(domain('active'));

    const result = await new ApplicationDomainsResource(http).waitUntilActive('app-1', 'dom-1', { intervalMs: 1 });

    expect(result.state).toBe('active');
    expect(http.get).toHaveBeenCalledTimes(5);
  });

  it('fails right away on a client error it cannot recover from', async () => {
    const http = createMockHttpClient();
    vi.mocked(http.get).mockRejectedValue(new ApiError('Forbidden', 403, 'forbidden'));

    await expect(
      new ApplicationDomainsResource(http).waitUntilActive('app-1', 'dom-1', { intervalMs: 1 })
    ).rejects.toMatchObject({ name: 'ApiError', status: 403 });
    expect(http.get).toHaveBeenCalledTimes(1);
  });

  it('keeps a final client error at the deadline instead of reporting a timeout', async () => {
    const http = createMockHttpClient();
    vi.mocked(http.get)
      .mockResolvedValueOnce(domain('pending_dns'))
      .mockImplementationOnce(() => {
        // Block synchronously past the deadline, so the 403 arrives late but before the poll's own timer fires.
        const until = Date.now() + 10;
        while (Date.now() < until);
        return Promise.reject(new ApiError('Forbidden', 403, 'forbidden'));
      });

    await expect(
      new ApplicationDomainsResource(http).waitUntilActive('app-1', 'dom-1', { intervalMs: 60_000, timeoutMs: 5 })
    ).rejects.toMatchObject({ name: 'ApiError', status: 403 });
  });

  it('reports a timeout when the last poll is cut off at the deadline', async () => {
    const http = createMockHttpClient();
    vi.mocked(http.get)
      .mockResolvedValueOnce(domain('pending_dns'))
      .mockImplementationOnce(
        (_path: string, options?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => reject(options.signal?.reason));
          })
      );

    await expect(
      new ApplicationDomainsResource(http).waitUntilActive('app-1', 'dom-1', { intervalMs: 60_000, timeoutMs: 5 })
    ).rejects.toMatchObject({ name: 'DomainNotActiveError', reason: 'timeout' });
  });

  it('honours the caller signal without AbortSignal.any, which Node 18 before 18.17 lacks', async () => {
    const http = createMockHttpClient();
    vi.mocked(http.get).mockImplementation(
      (_path: string, options?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(options.signal?.reason));
        })
    );
    const controller = new AbortController();
    const any = Object.getOwnPropertyDescriptor(AbortSignal, 'any');
    Object.defineProperty(AbortSignal, 'any', { value: undefined, configurable: true });
    try {
      const waiting = new ApplicationDomainsResource(http).waitUntilActive('app-1', 'dom-1', {
        signal: controller.signal,
      });
      controller.abort(new Error('cancelled'));
      await expect(waiting).rejects.toThrow('cancelled');
    } finally {
      if (any) Object.defineProperty(AbortSignal, 'any', any);
    }
  });

  it('checks once more at the deadline instead of giving up an interval early', async () => {
    const http = createMockHttpClient();
    vi.mocked(http.get).mockResolvedValueOnce(domain('issuing_certificate')).mockResolvedValueOnce(domain('active'));

    const result = await new ApplicationDomainsResource(http).waitUntilActive('app-1', 'dom-1', {
      intervalMs: 60_000,
      timeoutMs: 20,
    });

    expect(result.state).toBe('active');
  });

  it('passes a signal to every poll so a hung request is cancelled', async () => {
    const http = createMockHttpClient();
    vi.mocked(http.get).mockResolvedValue(domain('active'));

    await new ApplicationDomainsResource(http).waitUntilActive('app-1', 'dom-1');

    expect(http.get).toHaveBeenCalledWith('/applications/app-1/domains/dom-1', { signal: expect.any(AbortSignal) });
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

    expect(http.get).toHaveBeenCalledWith('/organizations/org-1/domains', { query: undefined });
    expect(http.post).toHaveBeenCalledWith('/organizations/org-1/domains', { name: 'example.com' });
    expect(http.get).toHaveBeenCalledWith('/organizations/org-1/domains/own-1');
    expect(http.post).toHaveBeenCalledWith('/organizations/org-1/domains/own-1/verify');
    expect(http.delete).toHaveBeenCalledWith('/organizations/org-1/domains/own-1');
  });
});

import { ApiError, GigadriveError } from '../errors';
import type { Paginated } from '../http-client';
import { BaseResource } from './base-resource';

/** Lifecycle state of a custom domain. Only `active` and `degraded` serve traffic. */
export type CustomDomainState =
  | 'pending_ownership'
  | 'pending_dns'
  | 'issuing_certificate'
  | 'active'
  | 'degraded'
  | 'failed'
  | 'suspended'
  | 'removing';

/** A DNS record to publish for a custom domain. */
export interface RequiredDnsRecord {
  /** `ownership` proves control of the domain; `routing` sends traffic to Gigadrive Network. */
  purpose: 'ownership' | 'routing';
  /** `ALIAS` stands for the apex record your DNS provider offers (ALIAS, ANAME or CNAME flattening). */
  type: 'TXT' | 'CNAME' | 'ALIAS';
  /** Fully qualified record name. */
  name: string;
  /** Record name relative to the registrable domain, as DNS dashboards expect it (`@` for the apex). */
  host: string;
  /** Record value to publish. */
  value: string;
  /** Whether the last check found the record. */
  status: 'ok' | 'pending' | 'mismatch';
}

/** What a custom domain serves. */
export interface CustomDomainTarget {
  type: 'production' | 'branch' | 'redirect';
  branchId: string | null;
  redirectTo: string | null;
  redirectStatusCode: 301 | 302 | 307 | 308 | null;
  redirectPreservePath: boolean;
}

/** A problem that keeps a domain from working, with a stable code and guidance. */
export interface DomainProblem {
  /** Stable code, for example `dns_record_missing` or `cert_blocked_caa`. */
  code: string;
  /** What is wrong and how to fix it. */
  message: string;
}

/** A hostname attached to an application. */
export interface CustomDomain {
  id: string;
  applicationId: string;
  /** Hostname in ASCII (punycode) form, lowercased. */
  hostname: string;
  /** Hostname for display, with international characters. */
  unicodeHostname: string;
  /** Registrable domain of the hostname. */
  apex: string;
  /** Whether the hostname is the registrable domain itself (needs an ALIAS record). */
  isApex: boolean;
  state: CustomDomainState;
  suspendedReason: 'claimed' | 'admin' | 'plan_limit' | null;
  target: CustomDomainTarget;
  /** Whether this is the application's primary URL. */
  primary: boolean;
  /** The domain whose verification authorizes this hostname. */
  ownership: { name: string | null; verified: boolean };
  /** DNS records to publish, in the order to add them. */
  requiredRecords: RequiredDnsRecord[];
  /** Why the domain is not working yet, or `null`. */
  error: DomainProblem | null;
  certificate: {
    status: 'none' | 'pending' | 'issued' | 'failed' | 'blocked_caa';
    expiresAt: string | null;
  };
  /** What the last DNS check saw, or `null` before the first check. */
  dns: {
    checkedAt: string | null;
    cname: string[];
    a: string[];
    aaaa: string[];
    nameservers: string[];
    pointsToEdge: boolean;
  } | null;
  /** When Gigadrive Network checks the domain next, or `null`. */
  nextCheckAt: string | null;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What a custom domain should serve. */
export type CustomDomainTargetInput =
  | { type: 'production' }
  | { type: 'branch'; branchId: string }
  | {
      type: 'redirect';
      /** Hostname to redirect to. */
      to: string;
      /** Defaults to `308`. */
      statusCode?: 301 | 302 | 307 | 308;
      /** Keep the path and query string. Defaults to `true`. */
      preservePath?: boolean;
    };

/** Input for {@link ApplicationDomainsResource.add}. */
export interface AddCustomDomainInput {
  /** Hostname such as `shop.example.com` or `example.com`. Normalized by the API. */
  hostname: string;
  /** Defaults to production. Redirects are available on paid plans. */
  target?: CustomDomainTargetInput;
}

/** Input for {@link ApplicationDomainsResource.update}. */
export interface UpdateCustomDomainInput {
  target?: CustomDomainTargetInput;
  /** Make this the application's primary URL. */
  primary?: boolean;
}

/** A domain an organization claimed or verified. */
export interface DomainOwnership {
  id: string;
  organizationId: string;
  name: string;
  unicodeName: string;
  status: 'pending' | 'verified';
  verificationMethod: 'txt' | 'nameservers' | 'domain_connect' | 'legacy_fqdn_txt' | null;
  /** The TXT record that proves control of the domain. */
  record: { type: 'TXT'; name: string; host: string; value: string };
  error: DomainProblem | null;
  verifiedAt: string | null;
  nextCheckAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Options for {@link ApplicationDomainsResource.waitUntilActive}. */
export interface WaitUntilActiveOptions {
  /** Give up after this long. Defaults to 10 minutes. */
  timeoutMs?: number;
  /** Time between checks. Defaults to 5 seconds. */
  intervalMs?: number;
  /** Stops waiting when aborted. */
  signal?: AbortSignal;
  /** Called with the domain whenever its state changes. */
  onState?: (domain: CustomDomain) => void;
}

/** Why {@link ApplicationDomainsResource.waitUntilActive} stopped without an active domain. */
export type DomainNotActiveReason = 'timeout' | 'failed' | 'suspended' | 'removing';

/**
 * Thrown by {@link ApplicationDomainsResource.waitUntilActive} when the domain did not become active
 * in time, stopped in a state that needs you to act (`failed` or `suspended`), or was removed.
 */
export class DomainNotActiveError extends GigadriveError {
  /** The domain as of the last successful check. */
  readonly domain: CustomDomain;
  /** `timeout` when the wait ran out, `removing` when the domain was removed, otherwise the state that ended it. */
  readonly reason: DomainNotActiveReason;

  constructor(domain: CustomDomain, reason: DomainNotActiveReason) {
    const detail = domain.error ? `: ${domain.error.message}` : '';
    super(
      reason === 'timeout'
        ? `${domain.unicodeHostname} is not active yet (state: ${domain.state})${detail}`
        : `${domain.unicodeHostname} is ${reason}${detail}`
    );
    this.name = 'DomainNotActiveError';
    this.domain = domain;
    this.reason = reason;
  }
}

const SERVING_STATES = new Set<CustomDomainState>(['active', 'degraded']);

/** Rate limits, server errors and network failures are worth another poll; anything else is final. */
const isTransient = (error: unknown) =>
  error instanceof ApiError ? error.status === 429 || error.status >= 500 : error instanceof TypeError;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new GigadriveError('Aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason instanceof Error ? signal.reason : new GigadriveError('Aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

/**
 * Custom domains attached to an application. Accessed via `client.applications.domains`.
 *
 * Adding a domain returns the DNS records to publish. Gigadrive Network then verifies ownership,
 * checks DNS, issues the certificate and starts serving on its own; poll {@link get} or use
 * {@link waitUntilActive}.
 */
export class ApplicationDomainsResource extends BaseResource {
  /**
   * List the custom domains of an application.
   *
   * @example
   * ```ts
   * const { items } = await client.applications.domains.list('app-id');
   * for (const domain of items) console.log(domain.hostname, domain.state);
   * ```
   */
  async list(applicationId: string): Promise<Paginated<CustomDomain>> {
    return this.httpClient.get(`/applications/${applicationId}/domains`);
  }

  /**
   * Attach a hostname to an application.
   *
   * @returns The new domain, including the `requiredRecords` to publish at your DNS provider.
   *
   * @example
   * ```ts
   * const domain = await client.applications.domains.add('app-id', { hostname: 'shop.example.com' });
   * for (const record of domain.requiredRecords) console.log(record.type, record.host, record.value);
   * ```
   */
  async add(applicationId: string, data: AddCustomDomainInput): Promise<CustomDomain> {
    return this.httpClient.post(`/applications/${applicationId}/domains`, data);
  }

  /** Get one custom domain with its current state. */
  async get(applicationId: string, domainId: string, options?: { signal?: AbortSignal }): Promise<CustomDomain> {
    const path = `/applications/${applicationId}/domains/${domainId}`;
    return options?.signal ? this.httpClient.get(path, { signal: options.signal }) : this.httpClient.get(path);
  }

  /**
   * Change what a domain serves, or make it the primary domain.
   *
   * @example
   * ```ts
   * await client.applications.domains.update('app-id', 'domain-id', {
   *   target: { type: 'redirect', to: 'www.example.com' },
   * });
   * ```
   */
  async update(applicationId: string, domainId: string, data: UpdateCustomDomainInput): Promise<CustomDomain> {
    return this.httpClient.patch(`/applications/${applicationId}/domains/${domainId}`, data);
  }

  /** Check the domain now instead of waiting for the next scheduled check. Rate limited. */
  async refresh(applicationId: string, domainId: string): Promise<CustomDomain> {
    return this.httpClient.post(`/applications/${applicationId}/domains/${domainId}/refresh`);
  }

  /** Stop serving the domain and remove it. */
  async remove(applicationId: string, domainId: string): Promise<void> {
    return this.httpClient.delete(`/applications/${applicationId}/domains/${domainId}`);
  }

  /**
   * Move a hostname another organization attached to this application. Verify the domain for your
   * organization first and keep its TXT record published: the claim checks the record again.
   */
  async claim(applicationId: string, hostname: string): Promise<CustomDomain> {
    return this.httpClient.post(`/applications/${applicationId}/domains/claim`, { hostname });
  }

  /**
   * Poll a domain until it serves traffic.
   *
   * Rate limits, server errors and network failures do not end the wait; the next poll retries until
   * the timeout. Aborting the signal or reaching the timeout also cancels a request in flight.
   *
   * @returns The domain once it is `active` (or `degraded`, which also serves).
   * @throws {DomainNotActiveError} When it fails, is suspended or removed, or the timeout runs out.
   *
   * @example
   * ```ts
   * const domain = await client.applications.domains.add('app-id', { hostname: 'shop.example.com' });
   * await client.applications.domains.waitUntilActive('app-id', domain.id, {
   *   onState: (current) => console.log(current.state),
   * });
   * ```
   */
  async waitUntilActive(
    applicationId: string,
    domainId: string,
    options: WaitUntilActiveOptions = {}
  ): Promise<CustomDomain> {
    const { timeoutMs = 10 * 60_000, intervalMs = 5_000, signal, onState } = options;
    const deadline = Date.now() + timeoutMs;
    let last: CustomDomain | undefined;

    for (;;) {
      const remaining = deadline - Date.now();
      const requestSignal = signal
        ? AbortSignal.any([signal, AbortSignal.timeout(Math.max(remaining, 1))])
        : AbortSignal.timeout(Math.max(remaining, 1));

      let domain: CustomDomain | undefined;
      try {
        domain = await this.get(applicationId, domainId, { signal: requestSignal });
      } catch (error) {
        if (signal?.aborted) throw error;
        // A domain that disappears mid-wait was removed; report it like any other terminal state.
        if (last && error instanceof ApiError && error.status === 404) throw new DomainNotActiveError(last, 'removing');
        const timedOut = Date.now() >= deadline;
        if (!timedOut && !isTransient(error)) throw error;
        if (timedOut && !last) throw error;
      }

      if (domain) {
        if (domain.state !== last?.state) onState?.(domain);
        last = domain;
        if (SERVING_STATES.has(domain.state)) return domain;
        if (domain.state === 'failed' || domain.state === 'suspended' || domain.state === 'removing') {
          throw new DomainNotActiveError(domain, domain.state);
        }
      }

      const untilDeadline = deadline - Date.now();
      if (untilDeadline <= 0) {
        if (last) throw new DomainNotActiveError(last, 'timeout');
        throw new GigadriveError('Timed out before the domain could be read');
      }
      // Sleep at most until the deadline, so the last check happens at the deadline and not an interval early.
      await sleep(Math.min(intervalMs, untilDeadline), signal);
    }
  }
}

/**
 * Domains an organization verified. Accessed via `client.organizations.domains`.
 *
 * A verified domain lets every application of the organization attach hostnames at or below it
 * without another TXT record.
 */
export class OrganizationDomainsResource extends BaseResource {
  /** List the organization's claimed and verified domains. */
  async list(organizationId: string): Promise<Paginated<DomainOwnership>> {
    return this.httpClient.get(`/organizations/${organizationId}/domains`);
  }

  /**
   * Claim a domain for verification.
   *
   * @returns The claim, including the TXT `record` to publish.
   *
   * @example
   * ```ts
   * const claim = await client.organizations.domains.add('org-id', 'example.com');
   * console.log(claim.record.host, claim.record.value);
   * ```
   */
  async add(organizationId: string, name: string): Promise<DomainOwnership> {
    return this.httpClient.post(`/organizations/${organizationId}/domains`, { name });
  }

  /** Get one claimed or verified domain. */
  async get(organizationId: string, domainId: string): Promise<DomainOwnership> {
    return this.httpClient.get(`/organizations/${organizationId}/domains/${domainId}`);
  }

  /** Check the TXT record now. Rate limited. */
  async verify(organizationId: string, domainId: string): Promise<DomainOwnership> {
    return this.httpClient.post(`/organizations/${organizationId}/domains/${domainId}/verify`);
  }

  /** Remove a domain. Refused while custom domains still rely on it. */
  async remove(organizationId: string, domainId: string): Promise<void> {
    return this.httpClient.delete(`/organizations/${organizationId}/domains/${domainId}`);
  }
}

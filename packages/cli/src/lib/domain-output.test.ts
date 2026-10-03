import type { CustomDomain } from '@gigadrive/sdk';
import { describe, expect, it } from 'vitest';
import { describeDomain, formatDnsRecords } from './domain-output';

const domain = (overrides: Partial<CustomDomain> = {}): CustomDomain => ({
  id: 'dom-1',
  applicationId: 'app-1',
  hostname: 'shop.example.com',
  unicodeHostname: 'shop.example.com',
  apex: 'example.com',
  isApex: false,
  state: 'pending_dns',
  suspendedReason: null,
  target: {
    type: 'production',
    branchId: null,
    redirectTo: null,
    redirectStatusCode: null,
    redirectPreservePath: true,
  },
  primary: false,
  ownership: { name: 'example.com', verified: false },
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

describe('formatDnsRecords', () => {
  it('aligns the columns and labels each record status', () => {
    const lines = formatDnsRecords([
      {
        purpose: 'ownership',
        type: 'TXT',
        name: '_gigadrive-challenge.example.com',
        host: '_gigadrive-challenge',
        value: 'gigadrive-verification=abc',
        status: 'pending',
      },
      {
        purpose: 'routing',
        type: 'CNAME',
        name: 'shop.example.com',
        host: 'shop',
        value: 'cname.gigadrive-dns.net',
        status: 'mismatch',
      },
    ]);

    expect(lines).toEqual([
      'Type   Name                  Value                       Status',
      'TXT    _gigadrive-challenge  gigadrive-verification=abc  waiting',
      'CNAME  shop                  cname.gigadrive-dns.net     different value',
    ]);
  });

  it('prints nothing without records', () => {
    expect(formatDnsRecords([])).toEqual([]);
  });
});

describe('describeDomain', () => {
  it('shows the state, target and problem', () => {
    expect(
      describeDomain(
        domain({
          primary: true,
          target: {
            type: 'redirect',
            branchId: null,
            redirectTo: 'www.example.com',
            redirectStatusCode: 301,
            redirectPreservePath: true,
          },
          error: { code: 'dns_record_missing', message: 'No DNS record points this hostname at Gigadrive yet.' },
        })
      )
    ).toEqual([
      'shop.example.com  waiting for DNS  (primary)',
      'Redirects to www.example.com (301)',
      'Problem (dns_record_missing): No DNS record points this hostname at Gigadrive yet.',
    ]);
  });

  it('shows the certificate expiry of a live domain', () => {
    expect(
      describeDomain(domain({ state: 'active', certificate: { status: 'issued', expiresAt: '2026-12-01T00:00:00Z' } }))
    ).toEqual(['shop.example.com  active', 'Certificate expires 2026-12-01T00:00:00Z']);
  });
});

import type { CustomDomain, CustomDomainState, RequiredDnsRecord } from '@gigadrive/sdk';

/** Human-readable label per lifecycle state, matching the console. */
export const DOMAIN_STATE_LABELS: Record<CustomDomainState, string> = {
  pending_ownership: 'verifying ownership',
  pending_dns: 'waiting for DNS',
  issuing_certificate: 'issuing certificate',
  active: 'active',
  degraded: 'needs attention',
  failed: 'failed',
  suspended: 'suspended',
  removing: 'removing',
};

const RECORD_STATUS_LABELS: Record<RequiredDnsRecord['status'], string> = {
  ok: 'found',
  pending: 'waiting',
  mismatch: 'different value',
};

/** States the lifecycle leaves on its own; waiting makes sense only while in one of these. */
export const IN_PROGRESS_STATES: ReadonlySet<CustomDomainState> = new Set([
  'pending_ownership',
  'pending_dns',
  'issuing_certificate',
]);

/**
 * Formats the DNS records a domain still needs as an aligned table, one line per record.
 *
 * @param records - The domain's required records.
 * @returns The table lines, header first. Empty when there are no records.
 *
 * @example
 * ```ts
 * formatDnsRecords(domain.requiredRecords).forEach((line) => console.log(line));
 * ```
 */
export const formatDnsRecords = (records: readonly RequiredDnsRecord[]): string[] => {
  if (records.length === 0) return [];
  const rows = [
    ['Type', 'Name', 'Value', 'Status'],
    ...records.map((record) => [record.type, record.host, record.value, RECORD_STATUS_LABELS[record.status]]),
  ];
  const widths = [0, 1, 2].map((column) => Math.max(...rows.map((row) => row[column].length)));
  return rows.map((row) =>
    row
      .map((cell, column) => (column < widths.length ? cell.padEnd(widths[column]) : cell))
      .join('  ')
      .trimEnd()
  );
};

/**
 * Summarizes a domain in a few lines: hostname, state, target, problem and certificate.
 *
 * @param domain - The domain to describe.
 * @returns The lines to print.
 */
export const describeDomain = (domain: CustomDomain): string[] => {
  const lines = [
    `${domain.unicodeHostname}  ${DOMAIN_STATE_LABELS[domain.state]}${domain.primary ? '  (primary)' : ''}`,
  ];
  if (domain.target.type === 'redirect' && domain.target.redirectTo !== null) {
    lines.push(`Redirects to ${domain.target.redirectTo} (${domain.target.redirectStatusCode ?? 308})`);
  } else if (domain.target.type === 'branch') {
    lines.push(`Serves branch ${domain.target.branchId ?? 'unknown'}`);
  }
  if (domain.error !== null) lines.push(`Problem (${domain.error.code}): ${domain.error.message}`);
  if (domain.certificate.expiresAt !== null) lines.push(`Certificate expires ${domain.certificate.expiresAt}`);
  return lines;
};

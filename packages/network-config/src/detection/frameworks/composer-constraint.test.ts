import { describe, expect, it } from 'vitest';
import { composerConstraintAllows } from './composer-constraint';

describe('composerConstraintAllows', () => {
  it.each([
    // Caret: the first non-zero segment may not change.
    { constraint: '^8.2', version: '8.4.12', allowed: true },
    { constraint: '^8.2', version: '8.2.0', allowed: true },
    { constraint: '^8.2', version: '8.1.30', allowed: false },
    { constraint: '^8.2', version: '9.0.0', allowed: false },
    { constraint: '^0.3', version: '0.3.9', allowed: true },
    { constraint: '^0.3', version: '0.4.0', allowed: false },
    { constraint: '^0.0.3', version: '0.0.4', allowed: false },
    // Tilde: the last given segment may grow.
    { constraint: '~8.3', version: '8.4.0', allowed: true },
    { constraint: '~8.3', version: '9.0.0', allowed: false },
    { constraint: '~8.3.0', version: '8.3.27', allowed: true },
    { constraint: '~8.3.0', version: '8.4.0', allowed: false },
    { constraint: '~8', version: '8.9.0', allowed: true },
    { constraint: '~8', version: '9.0.0', allowed: false },
    // Comparison operators compare against the zero-padded version.
    { constraint: '>=8.3', version: '8.3.0', allowed: true },
    { constraint: '>=8.3', version: '8.2.99', allowed: false },
    { constraint: '>8.3', version: '8.3.1', allowed: true },
    { constraint: '>8.3', version: '8.3.0', allowed: false },
    { constraint: '<=8.4', version: '8.4.0', allowed: true },
    { constraint: '<=8.4', version: '8.4.1', allowed: false },
    { constraint: '<8.4', version: '8.3.99', allowed: true },
    { constraint: '<8.4', version: '8.4.0', allowed: false },
    { constraint: '!=8.3.5', version: '8.3.5', allowed: false },
    { constraint: '!=8.3.5', version: '8.3.6', allowed: true },
    { constraint: '<>8.3.5', version: '8.3.5', allowed: false },
    // Exact versions.
    { constraint: '8.3.5', version: '8.3.5', allowed: true },
    { constraint: '8.3', version: '8.3.0', allowed: true },
    { constraint: '8.3', version: '8.3.1', allowed: false },
    { constraint: '=8.3.5', version: '8.3.5', allowed: true },
    { constraint: '==8.3.5', version: '8.3.6', allowed: false },
    { constraint: 'v8.3.5', version: '8.3.5', allowed: true },
    // Wildcards.
    { constraint: '8.3.*', version: '8.3.27', allowed: true },
    { constraint: '8.3.*', version: '8.4.0', allowed: false },
    { constraint: '8.3.x', version: '8.3.1', allowed: true },
    { constraint: '8.*', version: '8.4.0', allowed: true },
    { constraint: '8.*', version: '9.0.0', allowed: false },
    { constraint: '*', version: '8.4.0', allowed: true },
    // Hyphen ranges: a partial upper bound is a wildcard, a complete one is inclusive.
    { constraint: '8.1 - 8.3', version: '8.3.27', allowed: true },
    { constraint: '8.1 - 8.3', version: '8.4.0', allowed: false },
    { constraint: '8.1 - 8.3', version: '8.0.30', allowed: false },
    { constraint: '8.1 - 8', version: '8.4.0', allowed: true },
    { constraint: '8.1.0 - 8.3.5', version: '8.3.5', allowed: true },
    { constraint: '8.1.0 - 8.3.5', version: '8.3.6', allowed: false },
    // AND: commas or whitespace, with optional spaces after operators.
    { constraint: '>=8.1 <8.4', version: '8.3.27', allowed: true },
    { constraint: '>=8.1 <8.4', version: '8.4.0', allowed: false },
    { constraint: '>=8.1,<8.4', version: '8.4.0', allowed: false },
    { constraint: '>= 8.1, < 8.4', version: '8.3.0', allowed: true },
    { constraint: '^8.1 !=8.2.0', version: '8.2.0', allowed: false },
    // OR: `||` or the legacy `|`.
    { constraint: '^7.4 || ^8.0', version: '8.4.0', allowed: true },
    { constraint: '^7.4 || ~8.0.0', version: '8.4.0', allowed: false },
    { constraint: '^7.4|^8.0', version: '8.4.0', allowed: true },
    { constraint: '~8.3.0 || 8.1 - 8.2', version: '8.2.5', allowed: true },
    // Stability flags and pre-release suffixes are ignored.
    { constraint: '^8.1@dev', version: '8.4.0', allowed: true },
    { constraint: '>=8.4.0-RC1', version: '8.4.0', allowed: true },
    { constraint: '8.4.x-dev', version: '8.4.3', allowed: true },
  ])('$constraint allows $version: $allowed', ({ constraint, version, allowed }) => {
    expect(composerConstraintAllows(constraint, version)).toBe(allowed);
  });

  it.each(['', '   ', 'dev-main', 'abc', '^8.1 ||', '8.1 -', '>=8.*', '8.*.1', '1.2.3.4.5', '^', 'dev-main as 8.4'])(
    'cannot parse %j',
    (constraint) => {
      expect(composerConstraintAllows(constraint, '8.4.0')).toBeUndefined();
    }
  );

  it('cannot check a version that is not a release version', () => {
    expect(composerConstraintAllows('^8.2', '8.*')).toBeUndefined();
    expect(composerConstraintAllows('^8.2', 'latest')).toBeUndefined();
  });
});

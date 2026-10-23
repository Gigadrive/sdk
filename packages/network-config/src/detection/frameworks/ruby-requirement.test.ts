import { describe, expect, it } from 'vitest';
import { compareRubyVersions, parseRubyRequirement, parseRubyVersion, rubyRequirementAllows } from './ruby-requirement';

describe('parseRubyVersion', () => {
  it.each([
    { text: '3.3.6', segments: [3, 3, 6] },
    { text: '3.3', segments: [3, 3] },
    { text: '4.0.0', segments: [4, 0, 0] },
    { text: 'ruby-3.3.6', segments: [3, 3, 6] },
    { text: 'ruby-3.4.1', segments: [3, 4, 1] },
    { text: 'RUBY-3.4.1', segments: [3, 4, 1] },
    // Patchlevels and pre-releases keep only their release segments.
    { text: '3.3.6p108', segments: [3, 3, 6] },
    { text: '3.4.0-preview1', segments: [3, 4, 0] },
    { text: '3.4.0.rc1', segments: [3, 4, 0] },
    { text: '3.4.0dev', segments: [3, 4, 0] },
  ])('should parse $text', ({ text, segments }) => {
    expect(parseRubyVersion(text)).toEqual(segments);
  });

  it.each(['', 'jruby-9.4.5.0', 'truffleruby-24.1.0', 'system', 'latest', 'ref:v3_3_6', '3.3.x', 'v3.3.6', '>= 3.3'])(
    'should not parse %j',
    (text) => {
      expect(parseRubyVersion(text)).toBeUndefined();
    }
  );
});

describe('compareRubyVersions', () => {
  it.each([
    { a: [3, 3], b: [3, 3, 0], sign: 0 },
    { a: [3, 3, 0, 0], b: [3, 3], sign: 0 },
    { a: [3, 3, 1], b: [3, 3], sign: 1 },
    { a: [3, 4], b: [3, 10], sign: -1 },
    { a: [4], b: [3, 99, 99], sign: 1 },
  ])('should compare $a with $b', ({ a, b, sign }) => {
    expect(Math.sign(compareRubyVersions(a, b))).toBe(sign);
  });
});

describe('parseRubyRequirement', () => {
  it.each([
    { requirement: '3.3.6', atoms: [{ operator: '=', segments: [3, 3, 6] }] },
    { requirement: '= 3.3.6', atoms: [{ operator: '=', segments: [3, 3, 6] }] },
    { requirement: '~> 3.3', atoms: [{ operator: '~>', segments: [3, 3] }] },
    { requirement: '~>3.3', atoms: [{ operator: '~>', segments: [3, 3] }] },
    {
      requirement: '>= 3.2, < 4.0',
      atoms: [
        { operator: '>=', segments: [3, 2] },
        { operator: '<', segments: [4, 0] },
      ],
    },
  ])('should parse $requirement', ({ requirement, atoms }) => {
    expect(parseRubyRequirement(requirement)).toEqual(atoms);
  });

  it.each(['', '~>', '>= three', '>= 3.2,', '=> 3.2', '^3.3', '3.3 || 3.4', '>= 3.2 < 4.0'])(
    'should not parse %j',
    (requirement) => {
      expect(parseRubyRequirement(requirement)).toBeUndefined();
    }
  );
});

describe('rubyRequirementAllows', () => {
  it.each([
    // Pessimistic: drop the last segment, increment the new last one.
    { requirement: '~> 3.3', version: '3.3.0', allowed: true },
    { requirement: '~> 3.3', version: '3.4.9999', allowed: true },
    { requirement: '~> 3.3', version: '4.0.0', allowed: false },
    { requirement: '~> 3.3', version: '3.2.9', allowed: false },
    { requirement: '~> 3.3.1', version: '3.3.1', allowed: true },
    { requirement: '~> 3.3.1', version: '3.3.9999', allowed: true },
    { requirement: '~> 3.3.1', version: '3.3.0', allowed: false },
    { requirement: '~> 3.3.1', version: '3.4.0', allowed: false },
    { requirement: '~> 3.3.0', version: '3.3.9999', allowed: true },
    { requirement: '~> 3.3.0', version: '3.4.0', allowed: false },
    { requirement: '~> 3', version: '3.9.0', allowed: true },
    { requirement: '~> 3', version: '4.0.0', allowed: false },
    { requirement: '~> 4.0', version: '4.0.9999', allowed: true },
    // Comparisons, with missing trailing segments counting as zero.
    { requirement: '>= 3.2', version: '3.2.0', allowed: true },
    { requirement: '>= 3.2', version: '3.1.9', allowed: false },
    { requirement: '> 3.3', version: '3.3.0', allowed: false },
    { requirement: '> 3.3', version: '3.3.1', allowed: true },
    { requirement: '< 3.4', version: '3.3.9999', allowed: true },
    { requirement: '< 3.4', version: '3.4.0', allowed: false },
    { requirement: '<= 3.4', version: '3.4.0', allowed: true },
    { requirement: '<= 3.4', version: '3.4.1', allowed: false },
    { requirement: '!= 3.3.5', version: '3.3.5', allowed: false },
    { requirement: '!= 3.3.5', version: '3.3.6', allowed: true },
    // Exact versions, with or without `=`.
    { requirement: '3.3.6', version: '3.3.6', allowed: true },
    { requirement: '3.3', version: '3.3.0', allowed: true },
    { requirement: '3.3', version: '3.3.1', allowed: false },
    { requirement: '= 3.3.6', version: '3.3.7', allowed: false },
    { requirement: '=3.3.6', version: '3.3.6', allowed: true },
    // Comma-separated requirements must all hold.
    { requirement: '>= 3.2, < 3.4', version: '3.3.9999', allowed: true },
    { requirement: '>= 3.2, < 3.4', version: '3.4.0', allowed: false },
    { requirement: '>=3.2,<3.4', version: '3.1.0', allowed: false },
    { requirement: '~> 3.3, != 3.3.5', version: '3.3.5', allowed: false },
    { requirement: '~> 3.3, != 3.3.5', version: '3.4.1', allowed: true },
    // The version may carry a patchlevel.
    { requirement: '~> 3.3.0', version: '3.3.6p108', allowed: true },
  ])('should evaluate $requirement against $version as $allowed', ({ requirement, version, allowed }) => {
    expect(rubyRequirementAllows(requirement, version)).toBe(allowed);
  });

  it.each([
    { requirement: 'latest', version: '3.4.0' },
    { requirement: '>= 3.2 || < 3.0', version: '3.4.0' },
    { requirement: '~> 3.3', version: 'not a version' },
  ])('should return undefined for $requirement against $version', ({ requirement, version }) => {
    expect(rubyRequirementAllows(requirement, version)).toBeUndefined();
  });
});

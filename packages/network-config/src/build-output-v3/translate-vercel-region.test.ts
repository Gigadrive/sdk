import { describe, expect, test } from 'vitest';
import { translateVercelRegion } from './translate-vercel-region';

describe('translateVercelRegion', () => {
  test('translates known Vercel regions to AWS regions', () => {
    expect(translateVercelRegion('arn1')).toBe('eu-north-1');
    expect(translateVercelRegion('bom1')).toBe('ap-south-1');
    expect(translateVercelRegion('cdg1')).toBe('eu-west-3');
    expect(translateVercelRegion('lhr1')).toBe('eu-west-2');
    expect(translateVercelRegion('iad1')).toBe('us-east-1');
  });

  test('handles uppercase region codes', () => {
    expect(translateVercelRegion('ARN1')).toBe('eu-north-1');
    expect(translateVercelRegion('SFO1')).toBe('us-west-1');
  });

  test('returns us-east-1 as default for unknown regions', () => {
    expect(translateVercelRegion('unknown')).toBe('us-east-1');
    expect(translateVercelRegion('')).toBe('us-east-1');
  });
});

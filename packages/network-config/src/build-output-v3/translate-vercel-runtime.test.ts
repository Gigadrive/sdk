import { describe, expect, test } from 'vitest';
import { translateVercelRuntime } from './translate-vercel-runtime';

describe('translateVercelRuntime', () => {
  test('translates Node.js runtimes to standardized format', () => {
    expect(translateVercelRuntime('nodejs12.x')).toBe('node-18');
    expect(translateVercelRuntime('nodejs14.x')).toBe('node-18');
    expect(translateVercelRuntime('nodejs16.x')).toBe('node-18');
    expect(translateVercelRuntime('nodejs18.x')).toBe('node-18');
    expect(translateVercelRuntime('nodejs20.x')).toBe('node-20');
    expect(translateVercelRuntime('nodejs22.x')).toBe('node-20');
  });

  test('returns null for unsupported runtimes', () => {
    expect(translateVercelRuntime('python3.9')).toBeNull();
    expect(translateVercelRuntime('ruby2.7')).toBeNull();
    expect(translateVercelRuntime('unknown')).toBeNull();
    expect(translateVercelRuntime('')).toBeNull();
  });
});

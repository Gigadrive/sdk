import { describe, expect, it } from 'vitest';
import { enumDefault } from './enum-default';

describe('enumDefault', () => {
  it('returns default value for null input', () => {
    expect(enumDefault(null, 'DEFAULT')).toBe('DEFAULT');
  });

  it('returns default value for undefined input', () => {
    expect(enumDefault(undefined, 'DEFAULT')).toBe('DEFAULT');
  });

  it('returns default value for empty string', () => {
    expect(enumDefault('', 'DEFAULT')).toBe('DEFAULT');
  });

  it('returns default value for whitespace string', () => {
    expect(enumDefault('   ', 'DEFAULT')).toBe('DEFAULT');
  });

  it('returns default value for false', () => {
    expect(enumDefault(false, 'DEFAULT')).toBe('DEFAULT');
  });

  it('returns input value when valid', () => {
    expect(enumDefault('VALID', 'DEFAULT')).toBe('VALID');
  });
});

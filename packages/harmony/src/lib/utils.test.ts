import { describe, expect, it } from 'vitest';
import { getInitials } from './utils';

describe('getInitials', () => {
  it('should compute initials for multi-word names', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('should use the first two characters for single tokens', () => {
    expect(getInitials('gigadrive')).toBe('GI');
  });

  it('should handle hyphenated single tokens', () => {
    expect(getInitials('mary-jane')).toBe('MJ');
  });

  it('should return an empty string for empty input', () => {
    expect(getInitials('   ')).toBe('');
  });
});

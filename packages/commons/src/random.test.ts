import { describe, expect, it } from 'vitest';
import { randomIntInRange } from './random'; // Adjust the import path as needed

describe('randomIntInRange', () => {
  it('should return a number within the specified range', () => {
    const min = 1;
    const max = 10;
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      const result = randomIntInRange(min, max);
      expect(result).toBeGreaterThanOrEqual(min);
      expect(result).toBeLessThanOrEqual(max);
      expect(Number.isInteger(result)).toBe(true);
    }
  });

  it('should handle min and max being the same number', () => {
    const min = 5;
    const max = 5;
    const result = randomIntInRange(min, max);
    expect(result).toBe(5);
  });

  it('should handle negative numbers', () => {
    const min = -10;
    const max = -5;
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const result = randomIntInRange(min, max);
      expect(result).toBeGreaterThanOrEqual(min);
      expect(result).toBeLessThanOrEqual(max);
      expect(Number.isInteger(result)).toBe(true);
    }
  });

  it('should handle zero as a boundary', () => {
    const min = -5;
    const max = 5;
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const result = randomIntInRange(min, max);
      expect(result).toBeGreaterThanOrEqual(min);
      expect(result).toBeLessThanOrEqual(max);
      expect(Number.isInteger(result)).toBe(true);
    }
  });

  it('should throw error if min is greater than max', () => {
    const min = 10;
    const max = 1;
    expect(() => randomIntInRange(min, max)).toThrow();
  });
});

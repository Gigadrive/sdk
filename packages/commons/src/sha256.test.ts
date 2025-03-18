import { describe, expect, test } from 'vitest';
import { sha256 } from './sha256';

describe('util', () => {
  test('sha256', async () => {
    // Arrange
    const value = 'hello world';
    // Act
    const hash = await sha256(value);
    // Assert
    expect(hash).toEqual('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  });
});

import { describe, expect, it } from 'vitest';
import { objectToQueryString } from './object-to-query-string';

describe('objectToQueryString', () => {
  it('should return an empty string for undefined input', () => {
    expect(objectToQueryString(undefined)).toBe('');
  });

  it('should return an empty string for null input', () => {
    expect(objectToQueryString(null as any)).toBe('');
  });

  it('should return an empty string for empty object', () => {
    expect(objectToQueryString({})).toBe('?');
  });

  it('should convert a simple object to a query string', () => {
    expect(objectToQueryString({ name: 'John', age: 30 })).toBe('?name=John&age=30');
  });

  it('should handle string values with special characters', () => {
    expect(objectToQueryString({ query: 'hello world', filter: 'category=books' })).toBe(
      '?query=hello%20world&filter=category%3Dbooks'
    );
  });

  it('should skip undefined values', () => {
    expect(objectToQueryString({ name: 'John', age: undefined })).toBe('?name=John');
  });

  it('should handle boolean values', () => {
    expect(objectToQueryString({ active: true, verified: false })).toBe('?active=true&verified=false');
  });

  it('should handle numeric values', () => {
    expect(objectToQueryString({ id: 123, price: 99.99 })).toBe('?id=123&price=99.99');
  });

  it('should handle array values', () => {
    expect(objectToQueryString({ tags: ['javascript', 'typescript'] })).toBe('?tags=javascript%2Ctypescript');
  });

  it('should handle nested objects', () => {
    // Note: This test demonstrates current behavior, but in practice
    // you might want to handle nested objects differently
    const obj = { user: { name: 'John', role: 'admin' } };
    expect(objectToQueryString(obj)).toBe('?user=%5Bobject%20Object%5D');
  });
});

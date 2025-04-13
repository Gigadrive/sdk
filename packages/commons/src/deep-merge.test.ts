import { describe, expect, it } from 'vitest';
import { deepMerge } from './deep-merge';

describe('deepMerge', () => {
  it('should merge two objects correctly', () => {
    const target = { a: 1, b: { c: 2 } };
    const partial = { b: { d: 3 }, e: 4 };
    const expected = { a: 1, b: { c: 2, d: 3 }, e: 4 };
    expect(deepMerge(target, partial as any)).toEqual(expected);
  });

  it('should not modify the original target object if a deep copy is used', () => {
    const target = { a: 1, b: { c: 2 } };
    const partial = { b: { d: 3 }, e: 4 };
    const originalTarget = JSON.parse(JSON.stringify(target)); // Deep copy

    deepMerge(JSON.parse(JSON.stringify(target)), partial as any);

    expect(target).toEqual(originalTarget);
  });

  it('should handle nested objects correctly', () => {
    const target = { a: { b: { c: 1 } } };
    const partial = { a: { b: { d: 2 } } };
    const expected = { a: { b: { c: 1, d: 2 } } };
    expect(deepMerge(target, partial as any)).toEqual(expected);
  });

  it('should merge arrays by concatenating', () => {
    const target = { a: [1, 2] };
    const partial = { a: [3, 4] };
    const expected = { a: [1, 2, 3, 4] };
    expect(deepMerge(target, partial as any)).toEqual(expected);
  });

  it('should handle arrays of different types', () => {
    const target = { a: [1, 'hello'] };
    const partial = { a: [true, 2] };
    const expected = { a: [1, 'hello', true, 2] };
    expect(deepMerge(target, partial as any)).toEqual(expected);
  });

  it('should overwrite primitive values in target with values from partial', () => {
    const target = { a: 1, b: 'hello' };
    const partial = { a: 2, b: 'world' };
    const expected = { a: 2, b: 'world' };
    expect(deepMerge(target, partial as any)).toEqual(expected);
  });

  it('should add new properties from partial to target', () => {
    const target = { a: 1 };
    const partial = { b: 2 };
    const expected = { a: 1, b: 2 };
    expect(deepMerge(target, partial as any)).toEqual(expected);
  });

  it('should handle empty objects', () => {
    const target = {};
    const partial = { a: 1 };
    const expected = { a: 1 };
    expect(deepMerge(target, partial as any)).toEqual(expected);
  });

  it('should handle empty partial object', () => {
    const target = { a: 1 };
    const partial = {};
    const expected = { a: 1 };
    expect(deepMerge(target, partial as any)).toEqual(expected);
  });

  it('should handle null or undefined values in partial (overwrite with ' + 'null/undefined)', () => {
    const target = { a: 1, b: 'hello' };
    const partial = { a: null, b: undefined };
    const expected = { a: null, b: undefined };
    expect(deepMerge(target, partial as any)).toEqual(expected);
  });

  it('should handle a target value of null or undefined', () => {
    const target = null;
    const partial = { a: 1 };
    const expected = null;
    expect(deepMerge(target as any, partial as any)).toEqual(target);

    const target2 = undefined;
    const partial2 = { a: 1 };
    const expected2 = undefined;
    expect(deepMerge(target2 as any, partial2 as any)).toEqual(target2);
  });

  it('should handle a partial value of null or undefined', () => {
    const target = { a: 1 };
    const partial = null;
    const expected = { a: 1 };
    expect(deepMerge(target as any, partial as any)).toEqual(target);

    const target2 = { a: 1 };
    const partial2 = undefined;
    const expected2 = { a: 1 };
    expect(deepMerge(target2 as any, partial2 as any)).toEqual(target2);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { all } from './all';

describe('all function', () => {
  it('should resolve all promises with default concurrency', async () => {
    const promises = [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)];
    const results = await all(promises);
    expect(results).toEqual([1, 2, 3]);
  });

  it('should handle non-promise values', async () => {
    const values = [1, 2, 3];
    const results = await all(values);
    expect(results).toEqual([1, 2, 3]);
  });

  it('should handle mixed promise and non-promise values', async () => {
    const values = [1, Promise.resolve(2), 3];
    const results = await all(values);
    expect(results).toEqual([1, 2, 3]);
  });

  it('should throw error if concurrency limit is <= 0', async () => {
    const promises = [Promise.resolve(1), Promise.resolve(2)];
    await expect(all(promises, 0)).rejects.toThrow('Concurrency limit must be greater than 0');
    await expect(all(promises, -1)).rejects.toThrow('Concurrency limit must be greater than 0');
  });

  it('should handle empty array of promises', async () => {
    const results = await all([]);
    expect(results).toEqual([]);
  });

  it('should respect concurrency limit', async () => {
    const delayedPromise = (value: number, delay: number) =>
      new Promise<number>((resolve) => {
        setTimeout(() => resolve(value), delay);
      });

    const promises = [
      delayedPromise(1, 100),
      delayedPromise(2, 50),
      delayedPromise(3, 150),
      delayedPromise(4, 30),
      delayedPromise(5, 80),
    ];

    const results = await all(promises, 2);
    expect(results).toEqual([1, 2, 3, 4, 5]);
  });

  it('should propagate errors', async () => {
    const error = new Error('Test error');
    const promises = [Promise.resolve(1), Promise.reject(error), Promise.resolve(3)];
    await expect(all(promises)).rejects.toThrow('Test error');
  });

  it('should use Promise.all for Infinity concurrency', async () => {
    const originalPromiseAll = Promise.all;
    const mockPromiseAll = vi.fn().mockImplementation(originalPromiseAll);
    global.Promise.all = mockPromiseAll;

    try {
      const promises = [Promise.resolve(1), Promise.resolve(2)];
      await all(promises, Infinity);
      expect(mockPromiseAll).toHaveBeenCalledTimes(1);
    } finally {
      global.Promise.all = originalPromiseAll;
    }
  });

  it('should handle async functions', async () => {
    const asyncFn1 = async () => 1;
    const asyncFn2 = async () => 2;
    const asyncFn3 = async () => 3;

    const results = await all([asyncFn1(), asyncFn2(), asyncFn3()], 2);
    expect(results).toEqual([1, 2, 3]);
  });

  it('should maintain order of results regardless of completion time', async () => {
    const promises = [
      new Promise((resolve) => setTimeout(() => resolve(1), 100)),
      new Promise((resolve) => setTimeout(() => resolve(2), 10)),
      new Promise((resolve) => setTimeout(() => resolve(3), 50)),
    ];

    const results = await all(promises, 3);
    expect(results).toEqual([1, 2, 3]);
  });
});

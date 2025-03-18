import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sleep } from './sleep';

describe('sleep', () => {
  beforeEach(() => {
    // Reset timer mocks before each test
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore timer implementation after each test
    vi.useRealTimers();
  });

  it('should resolve after the specified time', async () => {
    const ms = 1000;
    const sleepPromise = sleep(ms);

    // Fast-forward time
    vi.advanceTimersByTime(ms);

    await expect(sleepPromise).resolves.toBeUndefined();
  });

  it('should not resolve before the specified time', async () => {
    const ms = 1000;
    let resolved = false;

    const sleepPromise = sleep(ms).then(() => {
      resolved = true;
    });

    // Advance time by less than the sleep duration
    vi.advanceTimersByTime(ms - 100);

    expect(resolved).toBe(false);

    // Complete the remaining time
    vi.advanceTimersByTime(100);
    await sleepPromise;
    expect(resolved).toBe(true);
  });

  it('should work with zero milliseconds', async () => {
    const sleepPromise = sleep(0);
    vi.advanceTimersByTime(0);
    await expect(sleepPromise).resolves.toBeUndefined();
  });

  it('should handle very large timeout values', async () => {
    const largeTimeout = Number.MAX_SAFE_INTEGER;
    const sleepPromise = sleep(largeTimeout);
    vi.advanceTimersByTime(largeTimeout);
    await expect(sleepPromise).resolves.toBeUndefined();
  });

  it('should coerce non-integer values to integers', async () => {
    const floatMs = 100.75;
    const sleepPromise = sleep(floatMs);
    vi.advanceTimersByTime(100); // setTimeout will use floor(100.75) = 100
    await expect(sleepPromise).resolves.toBeUndefined();
  });
});

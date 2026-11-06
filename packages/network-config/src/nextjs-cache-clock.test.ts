import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextClockLagMs } from './nextjs-cache-clock';

describe('nextClockLagMs', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ignores ordinary timer noise', () => {
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now() - performance.timeOrigin - 999);

    expect(nextClockLagMs()).toBe(0);
  });

  it('reports the time a resumed process spent paused', () => {
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now() - performance.timeOrigin - 3_600_000);

    expect(nextClockLagMs()).toBeGreaterThanOrEqual(3_600_000);
    expect(nextClockLagMs()).toBeLessThan(3_601_000);
  });
});

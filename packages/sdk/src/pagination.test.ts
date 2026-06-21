import { describe, expect, it, vi } from 'vitest';
import { paginate } from './pagination';

describe('paginate', () => {
  it('iterates items across cursor pages until nextCursor is absent', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: [1, 2], total: 4, nextCursor: 'c1' })
      .mockResolvedValueOnce({ items: [3, 4], total: 4 });

    const received: number[] = [];
    for await (const item of paginate<number>(fetchPage)) received.push(item);

    expect(received).toEqual([1, 2, 3, 4]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenNthCalledWith(1, undefined);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 'c1');
  });
});

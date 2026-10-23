import { describe, expect, it } from 'vitest';
import { durationToMs, sleep } from './duration';

describe('durationToMs', () => {
  it('treats numbers as milliseconds and parses unit strings', () => {
    expect(durationToMs(1500)).toBe(1500);
    expect(durationToMs(1.2)).toBe(2);
    expect(durationToMs('250ms')).toBe(250);
    expect(durationToMs('30s')).toBe(30_000);
    expect(durationToMs('10m')).toBe(600_000);
    expect(durationToMs('1.5h')).toBe(5_400_000);
    expect(durationToMs(' 2 m' as '2m')).toBe(120_000);
  });

  it('rejects invalid values', () => {
    expect(() => durationToMs(-1)).toThrow(RangeError);
    expect(() => durationToMs(Number.NaN)).toThrow(RangeError);
    expect(() => durationToMs('10' as '10m')).toThrow(/Invalid duration/);
    expect(() => durationToMs('5d' as '5m')).toThrow(/Invalid duration/);
  });
});

describe('sleep', () => {
  it('rejects with the abort reason', async () => {
    const controller = new AbortController();
    const pending = sleep(10_000, controller.signal);
    controller.abort(new Error('stop'));
    await expect(pending).rejects.toThrow('stop');
    await expect(sleep(1, controller.signal)).rejects.toThrow('stop');
  });

  it('resolves after the delay', async () => {
    await expect(sleep(1)).resolves.toBeUndefined();
  });
});

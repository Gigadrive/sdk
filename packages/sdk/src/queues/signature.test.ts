import { describe, expect, it } from 'vitest';

import { durationToSeconds } from './encoding';
import { signQueueDelivery, verifyQueueSignature } from './signature';

const T = 1_700_000_000_000;
const delivery = { secret: 'secret', queue: 'emails', messageId: 'm1', attempt: 2, body: '{"hello":"world"}' };

describe('queue signatures', () => {
  it('matches the platform signer byte for byte', async () => {
    // Same vector as network-queues signing.test.ts on the platform side.
    await expect(signQueueDelivery(delivery, T)).resolves.toBe(
      't=1700000000000,v1=d6a5eee13223c9afbb5d86bef1287f1ade8a6af7ad6e9af8429a1b8ee0d8d6d6'
    );
  });

  it('verifies a fresh signature over string and byte bodies', async () => {
    const header = await signQueueDelivery(delivery, T);
    await expect(verifyQueueSignature(header, delivery, T + 1_000)).resolves.toBe(true);
    await expect(
      verifyQueueSignature(header, { ...delivery, body: new TextEncoder().encode(delivery.body) }, T)
    ).resolves.toBe(true);
  });

  it('rejects tampering, the wrong secret, stale times and malformed headers', async () => {
    const header = await signQueueDelivery(delivery, T);
    await expect(verifyQueueSignature(header, { ...delivery, body: '{"hello":"there"}' }, T)).resolves.toBe(false);
    await expect(verifyQueueSignature(header, { ...delivery, attempt: 3 }, T)).resolves.toBe(false);
    await expect(verifyQueueSignature(header, { ...delivery, queue: 'other' }, T)).resolves.toBe(false);
    await expect(verifyQueueSignature(header, { ...delivery, secret: 'other' }, T)).resolves.toBe(false);
    await expect(verifyQueueSignature(header, delivery, T + 5 * 60_000 + 1)).resolves.toBe(false);
    await expect(verifyQueueSignature(header, { ...delivery, secret: '' }, T)).resolves.toBe(false);
    await expect(verifyQueueSignature(null, delivery, T)).resolves.toBe(false);
    await expect(verifyQueueSignature('v1=abc', delivery, T)).resolves.toBe(false);
    await expect(verifyQueueSignature('t=1700000000000,v1=', delivery, T)).resolves.toBe(false);
  });
});

describe('durationToSeconds', () => {
  it('accepts seconds and unit strings, rounding up', () => {
    expect(durationToSeconds(90)).toBe(90);
    expect(durationToSeconds('500ms')).toBe(1);
    expect(durationToSeconds('30s')).toBe(30);
    expect(durationToSeconds('10m')).toBe(600);
    expect(durationToSeconds('1.5h')).toBe(5_400);
    expect(durationToSeconds('7d')).toBe(604_800);
  });

  it('rejects malformed and negative durations', () => {
    expect(() => durationToSeconds('ten minutes' as never)).toThrow('Invalid duration');
    expect(() => durationToSeconds(-1)).toThrow('Invalid duration');
    expect(() => durationToSeconds(Number.NaN)).toThrow('Invalid duration');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { json, request, setup } from './test-utils';
import { MicroVmWebhookVerificationError, verifyMicroVmWebhook } from './webhooks';

// The reference vector of the Standard Webhooks specification.
const secret = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
const body = '{"test": 2432232314}';
const headers = {
  'webhook-id': 'msg_p5jXN8AQM9LWM0D4loKWxJek',
  'webhook-timestamp': '1614265330',
  'webhook-signature': 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=',
};

describe('verifyMicroVmWebhook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1614265330 * 1000 + 30_000);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts the reference request and returns its body', async () => {
    await expect(verifyMicroVmWebhook({ body, headers, secret })).resolves.toEqual({ test: 2432232314 });
  });

  it('reads Headers objects, mixed-case records, array values and byte bodies', async () => {
    await expect(verifyMicroVmWebhook({ body, headers: new Headers(headers), secret })).resolves.toBeTruthy();
    await expect(
      verifyMicroVmWebhook({
        body: new TextEncoder().encode(body),
        headers: {
          'Webhook-Id': headers['webhook-id'],
          'Webhook-Timestamp': [headers['webhook-timestamp']],
          'Webhook-Signature': headers['webhook-signature'],
        },
        secret,
      })
    ).resolves.toBeTruthy();
  });

  it('accepts any one matching signature among several', async () => {
    await expect(
      verifyMicroVmWebhook({
        body,
        headers: { ...headers, 'webhook-signature': `v1,bm9wZQ== v2,abc ${headers['webhook-signature']}` },
        secret,
      })
    ).resolves.toBeTruthy();
  });

  it.each([
    ['a changed body', { body: '{"test": 2432232315}' }],
    ['another secret', { secret: 'whsec_bm90IHRoZSBzZWNyZXQ=' }],
    ['a changed id', { headers: { ...headers, 'webhook-id': 'msg_other' } }],
    ['a garbled signature', { headers: { ...headers, 'webhook-signature': 'v1,%%%' } }],
    ['an unknown signature version', { headers: { ...headers, 'webhook-signature': 'v2,g0hM9SsE+OTPJTGt' } }],
  ])('rejects %s', async (_name, change) => {
    await expect(verifyMicroVmWebhook({ body, headers, secret, ...change })).rejects.toBeInstanceOf(
      MicroVmWebhookVerificationError
    );
  });

  it('rejects a missing header', async () => {
    const unsigned = { 'webhook-id': headers['webhook-id'], 'webhook-timestamp': headers['webhook-timestamp'] };
    await expect(verifyMicroVmWebhook({ body, headers: unsigned, secret })).rejects.toThrow(/missing/);
  });

  it('rejects a timestamp outside the tolerance, and honours a wider one', async () => {
    vi.setSystemTime(1614265330 * 1000 + 301_000);
    await expect(verifyMicroVmWebhook({ body, headers, secret })).rejects.toThrow(/timestamp/);
    await expect(verifyMicroVmWebhook({ body, headers, secret, toleranceSeconds: 600 })).resolves.toBeTruthy();
    await expect(
      verifyMicroVmWebhook({ body, headers: { ...headers, 'webhook-timestamp': '1614265330.5' }, secret })
    ).rejects.toThrow(/timestamp/);
  });

  it('rejects a body that is not JSON even when signed', async () => {
    const id = 'msg_1';
    const timestamp = '1614265330';
    const raw = 'not json';
    const key = await crypto.subtle.importKey(
      'raw',
      Uint8Array.from(atob(secret.slice(6)), (char) => char.charCodeAt(0)),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = btoa(
      String.fromCharCode(
        ...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${raw}`)))
      )
    );
    await expect(
      verifyMicroVmWebhook({
        body: raw,
        headers: { 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': `v1,${signature}` },
        secret,
      })
    ).rejects.toThrow(/not JSON/);
  });
});

const webhook = {
  id: 'wh-1',
  applicationId: 'app-1',
  url: 'https://example.com/hooks',
  description: null,
  events: ['microvm.stopped'],
  enabled: true,
  createdAt: '2026-11-01T12:00:00.000Z',
  updatedAt: '2026-11-01T12:00:00.000Z',
};

describe('client.microvms.webhooks', () => {
  it('creates a webhook for the default application', async () => {
    const { fetch, client } = setup({ applicationId: 'app-1' });
    fetch.mockResolvedValueOnce(json({ ...webhook, secret: 'whsec_c2VjcmV0' }, 201));

    const created = await client.microvms.webhooks.create({
      url: 'https://example.com/hooks',
      events: ['microvm.stopped'],
    });

    expect(created.secret).toBe('whsec_c2VjcmV0');
    expect(request(fetch).method).toBe('POST');
    expect(request(fetch).path).toBe('/microvm-webhooks');
    expect(request(fetch).json).toEqual({
      applicationId: 'app-1',
      url: 'https://example.com/hooks',
      events: ['microvm.stopped'],
    });
  });

  it('lists, gets, updates, rotates and deletes', async () => {
    const { fetch, client } = setup();
    fetch
      .mockResolvedValueOnce(json({ data: [webhook] }))
      .mockResolvedValueOnce(json(webhook))
      .mockResolvedValueOnce(json({ ...webhook, enabled: false }))
      .mockResolvedValueOnce(json({ ...webhook, secret: 'whsec_bmV3' }))
      .mockResolvedValueOnce(json(null, 204));

    await expect(client.microvms.webhooks.list({ applicationId: 'app-2' })).resolves.toEqual([webhook]);
    await client.microvms.webhooks.get('wh-1');
    await expect(client.microvms.webhooks.update('wh-1', { enabled: false })).resolves.toMatchObject({
      enabled: false,
    });
    await expect(client.microvms.webhooks.rotateSecret('wh-1')).resolves.toMatchObject({ secret: 'whsec_bmV3' });
    await client.microvms.webhooks.delete('wh-1');

    expect(request(fetch, 0).query).toEqual({ applicationId: 'app-2' });
    expect(request(fetch, 1).path).toBe('/microvm-webhooks/wh-1');
    expect(request(fetch, 2).method).toBe('PATCH');
    expect(request(fetch, 2).json).toEqual({ enabled: false });
    expect(request(fetch, 3).method).toBe('POST');
    expect(request(fetch, 3).path).toBe('/microvm-webhooks/wh-1/secret');
    expect(request(fetch, 4).method).toBe('DELETE');
    expect(request(fetch, 4).path).toBe('/microvm-webhooks/wh-1');
  });

  it('lists deliveries', async () => {
    const { fetch, client } = setup();
    const delivery = {
      id: 'd-1',
      messageId: 'msg_42',
      eventType: 'microvm.stopped',
      microvmId: 'vm-1',
      status: 'delivered',
      attempts: 1,
      lastStatusCode: 204,
      lastError: null,
      nextAttemptAt: null,
      deliveredAt: '2026-11-01T12:00:01.000Z',
      createdAt: '2026-11-01T12:00:00.000Z',
    };
    fetch.mockResolvedValueOnce(json({ data: [delivery] }));

    await expect(client.microvms.webhooks.listDeliveries('wh-1')).resolves.toEqual([delivery]);
    expect(request(fetch).path).toBe('/microvm-webhooks/wh-1/deliveries');
  });
});

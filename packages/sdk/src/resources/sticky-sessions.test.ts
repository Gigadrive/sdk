import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpClient } from '../http-client';
import { StickySessionsResource } from './sticky-sessions';

describe('StickySessionsResource', () => {
  const post = vi.fn();
  const resource = new StickySessionsResource({ post } as unknown as HttpClient);

  beforeEach(() => post.mockReset());

  it('creates a URL with the default GET method', async () => {
    post.mockResolvedValue({ url: 'wss://app.example/socket?__gd_sticky=token', expiresAt: '2026-01-01T00:00:00Z' });

    await expect(resource.createUrl({ key: 'game-1', endpoint: '/socket' })).resolves.toEqual({
      url: 'wss://app.example/socket?__gd_sticky=token',
      expiresAt: '2026-01-01T00:00:00Z',
    });
    expect(post).toHaveBeenCalledWith('/sticky-sessions/urls', {
      key: 'game-1',
      endpoint: '/socket',
      method: 'GET',
    });
  });

  it('preserves explicit method and expiry', async () => {
    post.mockResolvedValue({ url: 'https://app.example/api?__gd_sticky=token', expiresAt: '2026-01-01T00:00:00Z' });

    await resource.createUrl({ key: 'tenant', endpoint: '/api?view=1', method: 'POST', expiresInSeconds: 60 });

    expect(post).toHaveBeenCalledWith('/sticky-sessions/urls', {
      key: 'tenant',
      endpoint: '/api?view=1',
      method: 'POST',
      expiresInSeconds: 60,
    });
  });
});

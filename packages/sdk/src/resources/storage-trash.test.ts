import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../http-client';
import { StorageTrashResource } from './storage-trash';

const createMockHttpClient = (): HttpClient =>
  ({
    get: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    post: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
  }) as unknown as HttpClient;

describe('StorageTrashResource', () => {
  it('lists trashed objects by bucket name and environment', async () => {
    const http = createMockHttpClient();
    const resource = new StorageTrashResource(http, 'app-1');

    await resource.list('assets', { environment: 'production', prefix: 'images/', cursor: 'next', limit: 25 });
    expect(http.get).toHaveBeenCalledWith('/applications/app-1/storage/buckets/assets/trash', {
      query: { environment: 'production', prefix: 'images/', cursor: 'next', limit: 25 },
    });
  });

  it('restores a trashed object', async () => {
    const http = createMockHttpClient();
    const resource = new StorageTrashResource(http, 'app-1');

    await resource.restore('assets', 'object-1', { environment: 'preview' });
    expect(http.post).toHaveBeenCalledWith(
      '/applications/app-1/storage/buckets/assets/trash/object-1/restore',
      undefined,
      { query: { environment: 'preview' } }
    );
  });

  it('permanently purges a trashed object through an explicit legacy application call', async () => {
    const http = createMockHttpClient();
    const resource = new StorageTrashResource(http);
    const bucketId = '0197b2f4-5e70-7f3b-9d5c-555555555555';

    await expect(resource.purge('app-1', bucketId, 'object-1')).resolves.toBeUndefined();
    expect(http.delete).toHaveBeenCalledWith(`/applications/app-1/storage/buckets/${bucketId}/trash/object-1`, {
      query: { environment: undefined },
    });
  });

  it('empties a bucket trash and returns the purge count', async () => {
    const http = createMockHttpClient();
    vi.mocked(http.delete).mockResolvedValue({ purgedCount: 4 });
    const resource = new StorageTrashResource(http, 'app-1');

    await expect(resource.empty('assets', { environment: 'production' })).resolves.toEqual({ purgedCount: 4 });
    expect(http.delete).toHaveBeenCalledWith('/applications/app-1/storage/buckets/assets/trash', {
      query: { environment: 'production' },
    });
  });
});

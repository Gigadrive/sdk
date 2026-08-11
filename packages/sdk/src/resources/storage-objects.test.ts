import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../http-client';
import { StorageObjectsResource } from './storage-objects';

const createMockHttpClient = (getResult: unknown = { items: [], total: 0, commonPrefixes: [] }): HttpClient =>
  ({
    get: vi.fn().mockResolvedValue(getResult),
    delete: vi.fn().mockResolvedValue(undefined),
  }) as unknown as HttpClient;

describe('StorageObjectsResource', () => {
  it('lists objects by bucket name with environment and object filters', async () => {
    const http = createMockHttpClient();
    const resource = new StorageObjectsResource(http, 'app-1');

    await resource.list('assets', { environment: 'production', prefix: 'images/', limit: 100 });
    expect(http.get).toHaveBeenCalledWith('/applications/app-1/storage/buckets/assets/objects', {
      query: { environment: 'production', prefix: 'images/', limit: 100 },
    });
  });

  it('gets an object by id using inferred environment context', async () => {
    const http = createMockHttpClient();
    const resource = new StorageObjectsResource(http, 'app-1');

    await resource.get('assets', 'obj-1');
    expect(http.get).toHaveBeenCalledWith('/applications/app-1/storage/buckets/assets/objects/obj-1', {
      query: { environment: undefined },
    });
  });

  it('preserves explicit application and deprecated bucket UUID calls', async () => {
    const http = createMockHttpClient();
    const resource = new StorageObjectsResource(http);
    const bucketId = '0197b2f4-5e70-7f3b-9d5c-555555555555';

    await resource.get('app-1', bucketId, 'obj-1', { environment: 'production' });
    expect(http.get).toHaveBeenCalledWith(`/applications/app-1/storage/buckets/${bucketId}/objects/obj-1`, {
      query: { environment: 'production' },
    });
  });

  it('resolves an object by exact key and preserves environment context', async () => {
    const target = { id: 'obj-9', key: 'images/photo.jpg' };
    const http = createMockHttpClient({
      items: [target, { id: 'x', key: 'images/photo.jpg.bak' }],
      total: 2,
      commonPrefixes: [],
    });
    const resource = new StorageObjectsResource(http, 'app-1');

    const result = await resource.getByKey('assets', 'images/photo.jpg', { environment: 'preview' });
    expect(result).toEqual(target);
    expect(http.get).toHaveBeenCalledWith('/applications/app-1/storage/buckets/assets/objects', {
      query: { environment: 'preview', prefix: 'images/photo.jpg', cursor: undefined },
    });
  });

  it('pages through getByKey without losing application, bucket, or environment', async () => {
    const target = { id: 'obj-2', key: 'images/photo.jpg' };
    const get = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 'x', key: 'images/photo.jpg.bak' }],
        total: 2,
        commonPrefixes: [],
        nextCursor: 'c1',
      })
      .mockResolvedValueOnce({ items: [target], total: 2, commonPrefixes: [] });
    const resource = new StorageObjectsResource({ get } as unknown as HttpClient, 'app-1');

    const result = await resource.getByKey('assets', 'images/photo.jpg', { environment: 'production' });
    expect(result).toEqual(target);
    expect(get).toHaveBeenNthCalledWith(2, '/applications/app-1/storage/buckets/assets/objects', {
      query: { environment: 'production', prefix: 'images/photo.jpg', cursor: 'c1' },
    });
  });

  it('returns null from getByKey when no exact match exists', async () => {
    const http = createMockHttpClient({ items: [{ id: 'x', key: 'other.txt' }], total: 1, commonPrefixes: [] });
    const resource = new StorageObjectsResource(http, 'app-1');

    await expect(resource.getByKey('assets', 'missing.txt')).resolves.toBeNull();
  });

  it('soft-deletes an object by id', async () => {
    const http = createMockHttpClient();
    const resource = new StorageObjectsResource(http, 'app-1');

    await expect(resource.delete('assets', 'obj-1', { environment: 'production' })).resolves.toBeUndefined();
    expect(http.delete).toHaveBeenCalledWith('/applications/app-1/storage/buckets/assets/objects/obj-1', {
      query: { environment: 'production' },
    });
  });

  it('gets an access URL with environment and expiry', async () => {
    const http = createMockHttpClient();
    const resource = new StorageObjectsResource(http, 'app-1');

    await resource.getAccessUrl('assets', 'obj-1', { environment: 'production', expiresInSeconds: 3600 });
    expect(http.get).toHaveBeenCalledWith('/applications/app-1/storage/buckets/assets/objects/obj-1/access-url', {
      query: { environment: 'production', expiresInSeconds: 3600 },
    });
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../http-client';
import { StorageObjectsResource } from './storage-objects';

const createMockHttpClient = (getResult: unknown = { items: [], total: 0, commonPrefixes: [] }): HttpClient =>
  ({
    get: vi.fn().mockResolvedValue(getResult),
    delete: vi.fn().mockResolvedValue(undefined),
  }) as unknown as HttpClient;

describe('StorageObjectsResource', () => {
  it('should list objects with query params', async () => {
    const http = createMockHttpClient();
    const resource = new StorageObjectsResource(http);

    await resource.list('app-1', 'bucket-1', { prefix: 'images/', limit: 100 });
    expect(http.get).toHaveBeenCalledWith('/applications/app-1/storage/buckets/bucket-1/objects', {
      query: { prefix: 'images/', limit: 100 },
    });
  });

  it('should get an object by id', async () => {
    const http = createMockHttpClient();
    const resource = new StorageObjectsResource(http);

    await resource.get('app-1', 'bucket-1', 'obj-1');
    expect(http.get).toHaveBeenCalledWith('/applications/app-1/storage/buckets/bucket-1/objects/obj-1');
  });

  it('should resolve an object by key via getByKey', async () => {
    const target = { id: 'obj-9', key: 'images/photo.jpg' };
    const http = createMockHttpClient({
      items: [target, { id: 'x', key: 'images/photo.jpg.bak' }],
      total: 2,
      commonPrefixes: [],
    });
    const resource = new StorageObjectsResource(http);

    const result = await resource.getByKey('app-1', 'bucket-1', 'images/photo.jpg');
    expect(result).toEqual(target);
    expect(http.get).toHaveBeenCalledWith('/applications/app-1/storage/buckets/bucket-1/objects', {
      query: { prefix: 'images/photo.jpg', delimiter: '' },
    });
  });

  it('should page through results in getByKey until the exact key is found', async () => {
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
    const http = { get } as unknown as HttpClient;
    const resource = new StorageObjectsResource(http);

    const result = await resource.getByKey('app-1', 'bucket-1', 'images/photo.jpg');
    expect(result).toEqual(target);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenNthCalledWith(2, '/applications/app-1/storage/buckets/bucket-1/objects', {
      query: { prefix: 'images/photo.jpg', delimiter: '', cursor: 'c1' },
    });
  });

  it('should return null from getByKey when no exact match exists', async () => {
    const http = createMockHttpClient({ items: [{ id: 'x', key: 'other.txt' }], total: 1, commonPrefixes: [] });
    const resource = new StorageObjectsResource(http);

    const result = await resource.getByKey('app-1', 'bucket-1', 'missing.txt');
    expect(result).toBeNull();
  });

  it('should delete an object by id', async () => {
    const http = createMockHttpClient();
    const resource = new StorageObjectsResource(http);

    await resource.delete('app-1', 'bucket-1', 'obj-1');
    expect(http.delete).toHaveBeenCalledWith('/applications/app-1/storage/buckets/bucket-1/objects/obj-1');
  });

  it('should get an access URL under the bucket path with expiry', async () => {
    const http = createMockHttpClient();
    const resource = new StorageObjectsResource(http);

    await resource.getAccessUrl('app-1', 'bucket-1', 'obj-1', { expiresInSeconds: 3600 });
    expect(http.get).toHaveBeenCalledWith('/applications/app-1/storage/buckets/bucket-1/objects/obj-1/access-url', {
      query: { expiresInSeconds: 3600 },
    });
  });
});

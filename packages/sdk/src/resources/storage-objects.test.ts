import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../http-client';
import { StorageObjectsResource } from './storage-objects';

const createMockHttpClient = (): HttpClient =>
  ({
    get: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    delete: vi.fn().mockResolvedValue(undefined),
  }) as unknown as HttpClient;

describe('StorageObjectsResource', () => {
  it('should list objects', async () => {
    const http = createMockHttpClient();
    const resource = new StorageObjectsResource(http);

    await resource.list('app-1', 'bucket-1');
    expect(http.get).toHaveBeenCalledWith('/applications/app-1/storage/buckets/bucket-1/objects');
  });

  it('should get an object', async () => {
    const http = createMockHttpClient();
    const resource = new StorageObjectsResource(http);

    await resource.get('app-1', 'bucket-1', 'path/to/file.txt');
    expect(http.get).toHaveBeenCalledWith('/applications/app-1/storage/buckets/bucket-1/objects/path%2Fto%2Ffile.txt');
  });

  it('should delete an object', async () => {
    const http = createMockHttpClient();
    const resource = new StorageObjectsResource(http);

    await resource.delete('app-1', 'bucket-1', 'file.txt');
    expect(http.delete).toHaveBeenCalledWith('/applications/app-1/storage/buckets/bucket-1/objects/file.txt');
  });

  it('should get access URL', async () => {
    const http = createMockHttpClient();
    const resource = new StorageObjectsResource(http);

    await resource.getAccessUrl('app-1', 'obj-1');
    expect(http.get).toHaveBeenCalledWith('/applications/app-1/storage/objects/obj-1/access-url');
  });
});

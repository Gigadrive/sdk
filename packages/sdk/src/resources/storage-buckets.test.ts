import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../http-client';
import { StorageBucketsResource } from './storage-buckets';

const createMockHttpClient = (): HttpClient =>
  ({
    get: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    post: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
  }) as unknown as HttpClient;

describe('StorageBucketsResource', () => {
  it('should list buckets', async () => {
    const http = createMockHttpClient();
    const resource = new StorageBucketsResource(http);

    await resource.list('app-1');
    expect(http.get).toHaveBeenCalledWith('/applications/app-1/storage/buckets');
  });

  it('should create a bucket', async () => {
    const http = createMockHttpClient();
    const resource = new StorageBucketsResource(http);

    await resource.create('app-1', { name: 'my-bucket' });
    expect(http.post).toHaveBeenCalledWith('/applications/app-1/storage/buckets', { name: 'my-bucket' });
  });

  it('should get a bucket', async () => {
    const http = createMockHttpClient();
    const resource = new StorageBucketsResource(http);

    await resource.get('app-1', 'bucket-1');
    expect(http.get).toHaveBeenCalledWith('/applications/app-1/storage/buckets/bucket-1');
  });

  it('should delete a bucket', async () => {
    const http = createMockHttpClient();
    const resource = new StorageBucketsResource(http);

    await resource.delete('app-1', 'bucket-1');
    expect(http.delete).toHaveBeenCalledWith('/applications/app-1/storage/buckets/bucket-1');
  });
});

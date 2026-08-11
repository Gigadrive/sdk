import { describe, expect, it, vi } from 'vitest';
import { ConfigurationError } from '../errors';
import type { HttpClient } from '../http-client';
import { StorageBucketsResource } from './storage-buckets';

const createMockHttpClient = (): HttpClient =>
  ({
    get: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    post: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
  }) as unknown as HttpClient;

describe('StorageBucketsResource', () => {
  it('lists the configured application environment by slug', async () => {
    const http = createMockHttpClient();
    const resource = new StorageBucketsResource(http, 'app-1');

    await resource.list({ environment: 'production' });
    expect(http.get).toHaveBeenCalledWith('/applications/app-1/storage/buckets', {
      query: { environment: 'production' },
    });
  });

  it('creates a canonical named bucket with an environment selector', async () => {
    const http = createMockHttpClient();
    const resource = new StorageBucketsResource(http, 'app-1');

    await resource.create({ name: 'my-bucket', environment: 'production', visibility: 'public' });
    expect(http.post).toHaveBeenCalledWith('/applications/app-1/storage/buckets', {
      name: 'my-bucket',
      environment: 'production',
      visibility: 'public',
    });
  });

  it('preserves deprecated creation fields for compatibility', async () => {
    const http = createMockHttpClient();
    const resource = new StorageBucketsResource(http);

    await resource.create('app-1', {
      name: 'my-bucket',
      environmentId: '0197b2f8-92a4-734f-9b90-999999999999',
      slug: 'legacy-global-slug',
    });
    expect(http.post).toHaveBeenCalledWith('/applications/app-1/storage/buckets', {
      name: 'my-bucket',
      environmentId: '0197b2f8-92a4-734f-9b90-999999999999',
      slug: 'legacy-global-slug',
    });
  });

  it('forwards canonical and deprecated environment selectors for API conflict validation', async () => {
    const http = createMockHttpClient();
    const resource = new StorageBucketsResource(http, 'app-1');

    await resource.create({
      name: 'my-bucket',
      environment: 'production',
      environmentId: '0197b2f8-92a4-734f-9b90-999999999999',
    });
    expect(http.post).toHaveBeenCalledWith('/applications/app-1/storage/buckets', {
      name: 'my-bucket',
      environment: 'production',
      environmentId: '0197b2f8-92a4-734f-9b90-999999999999',
    });
  });

  it('gets a bucket by canonical name and environment UUID', async () => {
    const http = createMockHttpClient();
    const resource = new StorageBucketsResource(http, 'app-1');

    await resource.get('assets', { environment: '0197b2f8-92a4-734f-9b90-999999999999' });
    expect(http.get).toHaveBeenCalledWith('/applications/app-1/storage/buckets/assets', {
      query: { environment: '0197b2f8-92a4-734f-9b90-999999999999' },
    });
  });

  it('preserves explicit application and deprecated bucket UUID calls', async () => {
    const http = createMockHttpClient();
    const resource = new StorageBucketsResource(http);
    const bucketId = '0197b2f4-5e70-7f3b-9d5c-555555555555';

    await expect(resource.delete('app-1', bucketId)).resolves.toBeUndefined();
    expect(http.delete).toHaveBeenCalledWith(`/applications/app-1/storage/buckets/${bucketId}`, {
      query: { environment: undefined },
    });
  });

  it('fails locally when no application context is available', async () => {
    const resource = new StorageBucketsResource(createMockHttpClient());

    await expect(resource.get('assets')).rejects.toBeInstanceOf(ConfigurationError);
  });

  it('encodes invalid bucket references as one path segment', async () => {
    const http = createMockHttpClient();
    const resource = new StorageBucketsResource(http, 'app-1');

    await resource.delete('assets/objects/object-1');

    expect(http.delete).toHaveBeenCalledWith('/applications/app-1/storage/buckets/assets%2Fobjects%2Fobject-1', {
      query: { environment: undefined },
    });
  });
});

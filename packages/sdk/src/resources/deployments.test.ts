import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { HttpClient } from '../http-client';
import { DeploymentsResource, type DeploymentLogType } from './deployments';

const createMockHttpClient = (): HttpClient =>
  ({
    get: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    post: vi.fn().mockResolvedValue({ id: 'dep-1' }),
    fetchRaw: vi.fn().mockResolvedValue(new Response(null, { status: 200, headers: { ETag: '"etag-1"' } })),
  }) as unknown as HttpClient;

describe('DeploymentsResource', () => {
  it('types every deployment log severity returned by the Network API', () => {
    expectTypeOf<DeploymentLogType>().toEqualTypeOf<'INFO' | 'ERROR' | 'WARN' | 'DEBUG'>();
  });

  it('should list deployments', async () => {
    const http = createMockHttpClient();
    const resource = new DeploymentsResource(http);

    await resource.list();
    expect(http.get).toHaveBeenCalledWith('/deployments', { query: undefined });
  });

  it('should list deployments with query filters', async () => {
    const http = createMockHttpClient();
    const resource = new DeploymentsResource(http);

    await resource.list({ applicationId: 'app-1', status: 'ACTIVE' });
    expect(http.get).toHaveBeenCalledWith('/deployments', {
      query: { applicationId: 'app-1', status: 'ACTIVE' },
    });
  });

  it('should get a deployment', async () => {
    const http = createMockHttpClient();
    const resource = new DeploymentsResource(http);

    await resource.get('dep-1');
    expect(http.get).toHaveBeenCalledWith('/deployments/dep-1');
  });

  it('should create a deployment', async () => {
    const http = createMockHttpClient();
    const resource = new DeploymentsResource(http);

    await resource.create({ applicationId: 'app-1' });
    expect(http.post).toHaveBeenCalledWith('/deployments', { applicationId: 'app-1' });
  });

  it('should start a multipart upload', async () => {
    const http = createMockHttpClient();
    const resource = new DeploymentsResource(http);

    await resource.startUpload('dep-1');
    expect(http.post).toHaveBeenCalledWith('/deployments/dep-1/upload/start');
  });

  it('should get a presigned URL', async () => {
    const http = createMockHttpClient();
    const resource = new DeploymentsResource(http);

    await resource.getPresignedUrl('dep-1', 'upload-1', 1);
    expect(http.post).toHaveBeenCalledWith('/deployments/dep-1/upload/part', { uploadId: 'upload-1', partNumber: 1 });
  });

  it('should upload a part and return partNumber + etag', async () => {
    const http = createMockHttpClient();
    const resource = new DeploymentsResource(http);

    const data = new Uint8Array([1, 2, 3]);
    const result = await resource.uploadPart('https://s3.example.com/presigned', data, 1);

    expect(result).toEqual({ partNumber: 1, etag: '"etag-1"' });
    expect(http.fetchRaw).toHaveBeenCalledWith(
      'https://s3.example.com/presigned',
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('should complete a multipart upload', async () => {
    const http = createMockHttpClient();
    const resource = new DeploymentsResource(http);

    const parts = [{ partNumber: 1, etag: '"abc"' }];
    await resource.completeUpload('dep-1', 'upload-1', parts);
    expect(http.post).toHaveBeenCalledWith('/deployments/dep-1/upload/complete', { uploadId: 'upload-1', parts });
  });

  it('should get deployment logs', async () => {
    const http = createMockHttpClient();
    const resource = new DeploymentsResource(http);

    await resource.getLogs('dep-1', { offset: 0, limit: 10 });
    expect(http.get).toHaveBeenCalledWith('/deployments/dep-1/logs', {
      query: { offset: 0, limit: 10 },
    });
  });

  it('should list deployment hostnames', async () => {
    const http = createMockHttpClient();
    const resource = new DeploymentsResource(http);

    await resource.getHostnames('dep-1');
    expect(http.get).toHaveBeenCalledWith('/deployments/dep-1/hostnames');
  });
});

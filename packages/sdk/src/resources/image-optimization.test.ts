import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpClient } from '../http-client';
import { createManagedImageUrl, ImageOptimizationResource } from './image-optimization';

describe('ImageOptimizationResource', () => {
  const get = vi.fn();
  const remove = vi.fn();
  const resource = new ImageOptimizationResource({ get, delete: remove } as unknown as HttpClient);

  beforeEach(() => {
    get.mockReset();
    remove.mockReset();
  });

  it('inspects a deployment image policy and optional source tag', async () => {
    get.mockResolvedValue({ enabled: true, deploymentTag: 'deployment', sourceTag: 'source', policy: {} });

    await resource.inspect('dep_123', 'https://images.example/photo.jpg');

    expect(get).toHaveBeenCalledWith('/deployments/dep_123/image-cache', {
      query: { source: 'https://images.example/photo.jpg' },
    });
  });

  it('purges every deployment variant when no source is supplied', async () => {
    remove.mockResolvedValue({ purged: true, tag: 'deployment' });

    await expect(resource.purge('dep_123')).resolves.toEqual({ purged: true, tag: 'deployment' });
    expect(remove).toHaveBeenCalledWith('/deployments/dep_123/image-cache', { query: { source: undefined } });
  });

  it('creates a canonical framework-neutral image URL', () => {
    expect(
      createManagedImageUrl({
        origin: 'https://app.gigadrive.app',
        source: 'https://images.example/photo.jpg?version=2',
        width: 640,
        quality: 75,
        format: 'avif',
      })
    ).toBe(
      'https://app.gigadrive.app/_gigadrive/image/https%3A%2F%2Fimages.example%2Fphoto.jpg%3Fversion%3D2/photo.jpg?width=640&quality=75&format=avif'
    );
  });
});

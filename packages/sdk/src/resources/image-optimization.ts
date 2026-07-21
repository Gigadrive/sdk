import type { NormalizedImagePolicy } from '@gigadrive/network-config';

import { BaseResource } from './base-resource';

export interface ImageCacheInspection {
  enabled: boolean;
  deploymentTag: string;
  sourceTag: string | null;
  policy: NormalizedImagePolicy | null;
}

export interface ImageCachePurgeResult {
  purged: true;
  tag: string;
}

export interface ManagedImageUrlOptions {
  /** Deployment or custom application origin, for example `https://app.gigadrive.app`. */
  origin: string;
  /** Local application path or approved absolute remote URL. */
  source: string;
  filename?: string;
  width?: number;
  height?: number;
  quality?: number;
  format?: 'avif' | 'webp' | 'jpeg' | 'png';
  fit?: 'contain' | 'cover' | 'fill' | 'inside' | 'outside';
  variant?: string;
}

/** Creates the stable, framework-neutral managed image URL served on an application hostname. */
export const createManagedImageUrl = (options: ManagedImageUrlOptions): string => {
  const inferredFilename = options.source.split('/').filter(Boolean).at(-1)?.split('?')[0] || 'image.image';
  const filename = (options.filename ?? inferredFilename).replace(/[^A-Za-z0-9._-]/g, '_') || 'image.image';
  const url = new URL(
    `/_gigadrive/image/${encodeURIComponent(options.source)}/${encodeURIComponent(filename)}`,
    options.origin
  );
  for (const [name, value] of Object.entries({
    width: options.width,
    height: options.height,
    quality: options.quality,
    format: options.format,
    fit: options.fit,
    variant: options.variant,
  })) {
    if (value !== undefined) url.searchParams.set(name, String(value));
  }
  return url.toString();
};

/** Managed image optimization cache inspection and source/deployment purge operations. */
export class ImageOptimizationResource extends BaseResource {
  /** Create a managed image URL without making an API request. */
  url(options: ManagedImageUrlOptions): string {
    return createManagedImageUrl(options);
  }

  /** Inspect the immutable deployment policy and Bunny cache tags used for a source. */
  inspect(deploymentId: string, source?: string): Promise<ImageCacheInspection> {
    return this.httpClient.get(`/deployments/${deploymentId}/image-cache`, {
      query: { source },
    });
  }

  /** Purge all variants for one source, or every optimized image in the deployment when omitted. */
  purge(deploymentId: string, source?: string): Promise<ImageCachePurgeResult> {
    return this.httpClient.delete(`/deployments/${deploymentId}/image-cache`, {
      query: { source },
    });
  }
}

export interface NormalizedImageLocalPattern {
  pathname?: string;
  search?: string;
}

export interface NormalizedImageRemotePattern extends NormalizedImageLocalPattern {
  protocol?: 'http' | 'https';
  hostname: string;
  port?: string;
}

export type NormalizedImageFormat = 'image/avif' | 'image/webp' | 'image/jpeg' | 'image/png';
export type NormalizedImageFit = 'contain' | 'cover' | 'fill' | 'inside' | 'outside';

export interface NormalizedImageVariant {
  width?: number;
  height?: number;
  quality?: number;
  format?: NormalizedImageFormat;
  fit?: NormalizedImageFit;
}

export interface NormalizedImagePolicy {
  localPatterns: NormalizedImageLocalPattern[];
  remotePatterns: NormalizedImageRemotePattern[];
  widths: number[];
  heights: number[];
  qualities: number[];
  formats: NormalizedImageFormat[];
  minimumCacheTTL: number;
  dangerouslyAllowSVG: boolean;
  contentSecurityPolicy: string;
  contentDispositionType: 'inline' | 'attachment';
  maximumRedirects: number;
  maximumResponseBody: number;
  variants: Record<string, NormalizedImageVariant>;
}

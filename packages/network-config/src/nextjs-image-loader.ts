interface NextImageLoaderOptions {
  src: string;
  width: number;
  quality?: number;
}

const filenameHint = (source: string): string => {
  const pathname = source.startsWith('http://') || source.startsWith('https://') ? new URL(source).pathname : source;
  const candidate = pathname.split('/').filter(Boolean).at(-1)?.split('?')[0] ?? 'image';
  return /\.(?:avif|bmp|gif|hei[cf]|jpe?g|pbm|png|svg|tga|tiff?|webp)$/i.test(candidate)
    ? candidate
    : `${candidate || 'image'}.png`;
};

// Conservative bound below common CDN/proxy URL limits (~4-8 KB). The encoded
// source is embedded in the optimizer path, so an oversized source URL cannot
// be shortened losslessly — such images are served unoptimized instead.
const MAXIMUM_OPTIMIZER_URL_LENGTH = 2000;

/**
 * Removes Next's `dpl` deployment marker from a local source.
 *
 * Next appends `?dpl=<deploymentId>` to local asset sources whenever a
 * deployment id is configured. The Gigadrive optimizer resolves the deployment
 * from the request hostname and never reads `dpl`, so keeping it only changes
 * the optimizer URL on every deploy — invalidating the CDN's image cache for
 * files whose content-hashed names already guarantee freshness, and forcing a
 * full re-optimization burst after each release.
 */
const stripDeploymentMarker = (src: string): string => {
  if (!src.startsWith('/') || !src.includes('?')) return src;
  const [pathname, query] = src.split('?', 2);
  const parameters = new URLSearchParams(query);
  parameters.delete('dpl');
  const remaining = parameters.toString();
  return remaining ? `${pathname}?${remaining}` : pathname;
};

/** Builds the stable app-host URL consumed by Gigadrive's managed image optimizer. */
export default function gigadriveNextImageLoader({ src, width, quality }: NextImageLoaderOptions): string {
  const stableSrc = stripDeploymentMarker(src);
  const parameters = new URLSearchParams({ width: String(width) });
  if (quality !== undefined) parameters.set('quality', String(quality));
  const optimizerUrl = `/_gigadrive/image/${encodeURIComponent(stableSrc)}/${encodeURIComponent(filenameHint(stableSrc))}?${parameters}`;
  return optimizerUrl.length > MAXIMUM_OPTIMIZER_URL_LENGTH ? src : optimizerUrl;
}

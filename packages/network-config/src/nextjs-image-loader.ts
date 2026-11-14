interface NextImageLoaderOptions {
  src: string;
  width: number;
  quality?: number;
}

/**
 * `images.qualities` as the adapter inlined it at build. Next calls a custom
 * loader without its image config (`get-img-props`), so the adapter passes the
 * list through `env`, which Next inlines for this exact `process.env` read.
 */
const configuredQualities = (): number[] =>
  (process.env.GIGADRIVE_NEXT_IMAGE_QUALITIES ?? '')
    .split(',')
    .map(Number)
    .filter((quality) => Number.isInteger(quality) && quality > 0);

/** The quality Next's own loader uses when an image sets none. */
const DEFAULT_QUALITY = 75;

/**
 * The quality to encode at, chosen the way Next's default loader does
 * (`findClosestQuality`): the requested one, or 75, snapped to the closest of
 * `images.qualities` when the app restricts them. Without it the optimizer
 * encodes at its own, higher default, which made Gigadrive's images about 40%
 * larger than the same images on Vercel.
 */
const resolveQuality = (quality: number | undefined, qualities: readonly number[]): number => {
  const requested = quality || DEFAULT_QUALITY;
  if (!qualities.length) return requested;
  return qualities.reduce(
    (closest, candidate) => (Math.abs(candidate - requested) < Math.abs(closest - requested) ? candidate : closest),
    qualities[0]
  );
};

/** The path portion of a source, with any query string or fragment removed. */
const sourcePathname = (source: string): string =>
  source.startsWith('http://') || source.startsWith('https://') ? new URL(source).pathname : source.split(/[?#]/, 1)[0];

const filenameHint = (source: string): string => {
  const candidate = sourcePathname(source).split('/').filter(Boolean).at(-1) ?? 'image';
  return /\.(?:avif|bmp|gif|hei[cf]|jpe?g|pbm|png|svg|tga|tiff?|webp)$/i.test(candidate)
    ? candidate
    : `${candidate || 'image'}.png`;
};

const isSvgSource = (source: string): boolean => /\.svg$/i.test(sourcePathname(source));

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
  // No optimizer backend can rasterize SVG, so routing one through the optimizer
  // is always a pass-through: a wasted redirect and an extra request for bytes
  // the origin already serves. Next's own get-img-props marks `.svg` unoptimized
  // before any loader runs, but that bypass is skipped once a custom loaderFile
  // is configured — which is exactly what this adapter injects.
  if (isSvgSource(src)) return src;

  const stableSrc = stripDeploymentMarker(src);
  const parameters = new URLSearchParams({
    width: String(width),
    quality: String(resolveQuality(quality, configuredQualities())),
  });
  const optimizerUrl = `/_gigadrive/image/${encodeURIComponent(stableSrc)}/${encodeURIComponent(filenameHint(stableSrc))}?${parameters}`;
  return optimizerUrl.length > MAXIMUM_OPTIMIZER_URL_LENGTH ? src : optimizerUrl;
}

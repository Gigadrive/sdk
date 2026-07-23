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

/** Builds the stable app-host URL consumed by Gigadrive's managed image optimizer. */
export default function gigadriveNextImageLoader({ src, width, quality }: NextImageLoaderOptions): string {
  const parameters = new URLSearchParams({ width: String(width) });
  if (quality !== undefined) parameters.set('quality', String(quality));
  const optimizerUrl = `/_gigadrive/image/${encodeURIComponent(src)}/${encodeURIComponent(filenameHint(src))}?${parameters}`;
  return optimizerUrl.length > MAXIMUM_OPTIMIZER_URL_LENGTH ? src : optimizerUrl;
}

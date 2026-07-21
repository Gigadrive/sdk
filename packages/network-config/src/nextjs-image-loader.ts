interface NextImageLoaderOptions {
  src: string;
  width: number;
  quality?: number;
}

const filenameHint = (source: string): string => {
  const pathname = source.startsWith('http://') || source.startsWith('https://') ? new URL(source).pathname : source;
  const candidate = pathname.split('/').filter(Boolean).at(-1)?.split('?')[0] ?? 'image';
  return /\.[A-Za-z0-9]{2,5}$/.test(candidate) ? candidate : `${candidate || 'image'}.image`;
};

/** Builds the stable app-host URL consumed by Gigadrive's managed image optimizer. */
export default function gigadriveNextImageLoader({ src, width, quality }: NextImageLoaderOptions): string {
  const parameters = new URLSearchParams({ width: String(width) });
  if (quality !== undefined) parameters.set('quality', String(quality));
  return `/_gigadrive/image/${encodeURIComponent(src)}/${encodeURIComponent(filenameHint(src))}?${parameters}`;
}

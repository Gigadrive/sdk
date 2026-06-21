/**
 * Minimal filename → MIME type inference used to populate an upload's content
 * type when the caller does not provide one. Intentionally dependency-free and
 * covers the most common web/asset types; callers can always pass an explicit
 * `contentType` to override.
 *
 * @internal
 */

const MIME_TYPES: Record<string, string> = {
  // Text & code
  txt: 'text/plain',
  csv: 'text/csv',
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  json: 'application/json',
  xml: 'application/xml',
  md: 'text/markdown',
  // Images
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  heic: 'image/heic',
  // Audio
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  flac: 'audio/flac',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  // Video
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  // Documents
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Archives & binaries
  zip: 'application/zip',
  gz: 'application/gzip',
  tar: 'application/x-tar',
  br: 'application/x-brotli',
  wasm: 'application/wasm',
  // Fonts
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
};

/**
 * Infer a MIME type from a filename or object key by its extension.
 *
 * @param nameOrKey - A filename or object key (e.g. `"images/photo.jpg"`).
 * @returns The inferred MIME type, or `undefined` if the extension is unknown.
 */
export const inferContentType = (nameOrKey: string): string | undefined => {
  const lastDot = nameOrKey.lastIndexOf('.');
  if (lastDot === -1 || lastDot === nameOrKey.length - 1) return undefined;
  const ext = nameOrKey.slice(lastDot + 1).toLowerCase();
  return MIME_TYPES[ext];
};

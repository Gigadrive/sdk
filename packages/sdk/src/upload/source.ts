/**
 * Resolves the various accepted upload inputs (in-memory bytes, a Node.js file
 * path, or a Node.js readable stream) into the concrete values the upload flow
 * needs: the object tus-js-client consumes, the byte size, an inferred content
 * type, and the required checksums.
 *
 * @internal
 */

import { computeChecksums, hashNodeFile, type Checksums } from './checksum';
import { inferContentType } from './content-type';

/** A minimal Node.js `Readable`-like shape (avoids depending on `node:stream` types). */
export interface NodeReadableLike {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  pipe?: unknown;
  read?: unknown;
}

/** In-memory data accepted by the upload helpers. `Buffer` is a `Uint8Array`. */
export type UploadData = Blob | ArrayBuffer | Uint8Array;

/** The tus-js-client file input union. */
export type TusFile = File | Blob | Uint8Array | NodeReadableLike;

/** Input describing what to upload and any pre-supplied metadata. */
export interface UploadSourceInput {
  /** The object key/path the upload targets — used to infer content type. */
  key: string;
  /** In-memory data (browser `File`/`Blob`, Node `Buffer`, `Uint8Array`, `ArrayBuffer`). */
  data?: UploadData;
  /** A filesystem path to stream from (Node.js only). */
  path?: string;
  /** A readable stream (Node.js only). Requires `contentLength` and `checksumSha256`. */
  stream?: NodeReadableLike;
  /** Explicit content type. Inferred from `key` when omitted. */
  contentType?: string;
  /** Explicit byte size. Required for `stream`; computed otherwise. */
  contentLength?: number;
  /** Pre-computed SHA-256 (skips hashing). Required for `stream`. */
  checksumSha256?: string;
  /** Pre-computed SHA-1. */
  checksumSha1?: string;
  /** Pre-computed MD5. */
  checksumMd5?: string;
}

/** The fully resolved upload source. */
export interface ResolvedUploadSource {
  /** The value handed to tus-js-client. */
  tusFile: TusFile;
  /** Total upload size in bytes. */
  size: number;
  /** Resolved content type, if known. */
  contentType?: string;
  /** Checksums (always includes SHA-256). */
  checksums: Checksums;
  /** Whether a finite chunk size is required (true for streamed/file-path inputs). */
  requiresFiniteChunkSize: boolean;
}

const isNode = (): boolean => typeof process !== 'undefined' && !!process.versions?.node;

const toBytes = async (data: UploadData): Promise<Uint8Array> => {
  if (typeof Blob !== 'undefined' && data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  throw new Error('Unsupported upload data type. Pass a File, Blob, Buffer, Uint8Array, or ArrayBuffer.');
};

const sizeOf = (data: UploadData): number => {
  if (typeof Blob !== 'undefined' && data instanceof Blob) return data.size;
  if (data instanceof Uint8Array) return data.byteLength;
  if (data instanceof ArrayBuffer) return data.byteLength;
  throw new Error('Cannot determine upload size. Pass a File, Blob, Buffer, Uint8Array, or ArrayBuffer.');
};

/** Convert in-memory data into a value tus-js-client accepts in the current runtime. */
const toTusFile = (data: UploadData): TusFile => {
  // Node accepts Buffer/Uint8Array directly; browsers are happiest with a Blob.
  if (data instanceof Uint8Array) return isNode() ? data : new Blob([data]);
  if (typeof Blob !== 'undefined' && data instanceof Blob) return data;
  const bytes = new Uint8Array(data as ArrayBuffer);
  return isNode() ? bytes : new Blob([bytes]);
};

/**
 * Build the checksum set, always honoring caller-supplied SHA-1/MD5 (they are
 * passed through, never recomputed). Only SHA-256 is ever computed by the SDK.
 */
const buildChecksums = (input: UploadSourceInput, sha256: string): Checksums => {
  const checksums: Checksums = { sha256 };
  if (input.checksumSha1) checksums.sha1 = input.checksumSha1;
  if (input.checksumMd5) checksums.md5 = input.checksumMd5;
  return checksums;
};

/**
 * Resolve an {@link UploadSourceInput} into a {@link ResolvedUploadSource},
 * computing size, content type, and the SHA-256 as needed.
 *
 * @param input - The upload source description. Exactly one of `data`, `path`,
 *   or `stream` must be provided.
 * @param options - Set `hash: false` to skip SHA-256 computation (e.g. when
 *   uploading to an already-authorized URL, where checksums are not needed).
 */
export const resolveUploadSource = async (
  input: UploadSourceInput,
  options: { hash?: boolean } = {}
): Promise<ResolvedUploadSource> => {
  const sourceCount = [input.data !== undefined, input.path !== undefined, input.stream !== undefined].filter(
    Boolean
  ).length;
  if (sourceCount > 1) {
    throw new Error('Provide only one upload source: data, path, or stream.');
  }

  const hash = options.hash !== false;
  const contentType = input.contentType ?? inferContentType(input.key);

  if (input.data !== undefined) {
    const size = input.contentLength ?? sizeOf(input.data);
    const sha256 = input.checksumSha256 ?? (hash ? (await computeChecksums(await toBytes(input.data))).sha256 : '');
    return {
      tusFile: toTusFile(input.data),
      size,
      contentType,
      checksums: buildChecksums(input, sha256),
      requiresFiniteChunkSize: false,
    };
  }

  if (input.path !== undefined) {
    if (!isNode()) throw new Error('Uploading from a file path is only supported in Node.js.');
    const fs = await import('node:fs');
    const size = input.contentLength ?? fs.statSync(input.path).size;
    const sha256 = input.checksumSha256 ?? (hash ? (await hashNodeFile(input.path)).sha256 : '');
    // A fresh read stream is handed to tus for the byte upload.
    const tusFile = fs.createReadStream(input.path) as unknown as NodeReadableLike;
    return { tusFile, size, contentType, checksums: buildChecksums(input, sha256), requiresFiniteChunkSize: true };
  }

  if (input.stream !== undefined) {
    if (input.contentLength === undefined) {
      throw new Error('Uploading from a stream requires contentLength to be provided.');
    }
    if (hash && !input.checksumSha256) {
      throw new Error('Uploading from a stream requires checksumSha256 to be provided.');
    }
    return {
      tusFile: input.stream,
      size: input.contentLength,
      contentType,
      checksums: buildChecksums(input, input.checksumSha256 ?? ''),
      requiresFiniteChunkSize: true,
    };
  }

  throw new Error('No upload source provided. Pass one of: data, path, or stream.');
};

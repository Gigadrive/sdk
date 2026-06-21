/**
 * Checksum helpers used to satisfy the storage upload contract, which requires
 * a SHA-256 of the object content (SHA-1 and MD5 are optional integrity hints).
 *
 * SHA-256 and SHA-1 are computed with the Web Crypto API (`crypto.subtle`),
 * which is available in modern browsers and Node.js 18+. MD5 is not provided by
 * Web Crypto, so it is computed with Node's `crypto` module and is therefore
 * Node-only — pass `checksumMd5` explicitly if you need it in the browser.
 *
 * @internal
 */

/** A set of computed content checksums (lowercase hex). */
export interface Checksums {
  /** SHA-256 checksum. Always computed. */
  sha256: string;
  /** SHA-1 checksum, when requested. */
  sha1?: string;
  /** MD5 checksum, when requested (Node.js only). */
  md5?: string;
}

/** Which optional checksums to compute alongside the always-required SHA-256. */
export interface ChecksumRequest {
  /** Also compute a SHA-1 checksum. */
  sha1?: boolean;
  /** Also compute an MD5 checksum (Node.js only). */
  md5?: boolean;
}

const toHex = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
};

const subtleDigest = async (algorithm: 'SHA-256' | 'SHA-1', bytes: Uint8Array): Promise<string> =>
  toHex(await crypto.subtle.digest(algorithm, bytes));

const importNodeCrypto = async (): Promise<typeof import('node:crypto') | null> => {
  if (typeof process === 'undefined' || !process.versions?.node) return null;
  try {
    return await import('node:crypto');
  } catch {
    return null;
  }
};

const md5Hex = async (bytes: Uint8Array): Promise<string> => {
  const nodeCrypto = await importNodeCrypto();
  if (!nodeCrypto) {
    throw new Error('MD5 checksums are only supported in Node.js. Provide checksumMd5 explicitly in the browser.');
  }
  return nodeCrypto.createHash('md5').update(bytes).digest('hex');
};

/**
 * Compute checksums for an in-memory byte buffer.
 *
 * @param bytes - The content bytes.
 * @param request - Which optional checksums to compute (SHA-256 is always computed).
 */
export const computeChecksums = async (bytes: Uint8Array, request: ChecksumRequest = {}): Promise<Checksums> => {
  const checksums: Checksums = { sha256: await subtleDigest('SHA-256', bytes) };
  if (request.sha1) checksums.sha1 = await subtleDigest('SHA-1', bytes);
  if (request.md5) checksums.md5 = await md5Hex(bytes);
  return checksums;
};

/**
 * Compute checksums for a file on disk by streaming it through Node's hashing
 * primitives — avoids loading the whole file into memory. Node.js only.
 *
 * @param path - Filesystem path to hash.
 * @param request - Which optional checksums to compute (SHA-256 is always computed).
 */
export const hashNodeFile = async (path: string, request: ChecksumRequest = {}): Promise<Checksums> => {
  const [fs, nodeCrypto] = await Promise.all([import('node:fs'), import('node:crypto')]);
  const sha256 = nodeCrypto.createHash('sha256');
  const sha1 = request.sha1 ? nodeCrypto.createHash('sha1') : null;
  const md5 = request.md5 ? nodeCrypto.createHash('md5') : null;

  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(path);
    stream.on('data', (chunk) => {
      sha256.update(chunk);
      sha1?.update(chunk);
      md5?.update(chunk);
    });
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });

  const checksums: Checksums = { sha256: sha256.digest('hex') };
  if (sha1) checksums.sha1 = sha1.digest('hex');
  if (md5) checksums.md5 = md5.digest('hex');
  return checksums;
};

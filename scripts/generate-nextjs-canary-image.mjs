import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const width = 128;
const height = 96;
const target = resolve(import.meta.dirname, '../fixtures/nextjs-platform-canary/public/canary.png');

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

const crc32 = (value) => {
  let crc = 0xffffffff;
  for (const byte of value) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (name, data) => {
  const type = Buffer.from(name, 'ascii');
  const length = Buffer.allocUnsafe(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.allocUnsafe(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, checksum]);
};

const imageHeader = Buffer.alloc(13);
imageHeader.writeUInt32BE(width, 0);
imageHeader.writeUInt32BE(height, 4);
imageHeader[8] = 8;
imageHeader[9] = 6;

const pixels = Buffer.alloc((width * 4 + 1) * height);
for (let y = 0; y < height; y += 1) {
  const row = y * (width * 4 + 1);
  for (let x = 0; x < width; x += 1) {
    const offset = row + 1 + x * 4;
    pixels[offset] = Math.round((x / (width - 1)) * 255);
    pixels[offset + 1] = Math.round((y / (height - 1)) * 255);
    pixels[offset + 2] = 180;
    pixels[offset + 3] = x < 16 || y < 16 ? 96 : 255;
  }
}

const generated = Buffer.concat([
  Buffer.from('89504e470d0a1a0a', 'hex'),
  chunk('IHDR', imageHeader),
  chunk('IDAT', deflateSync(pixels, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

if (process.argv.includes('--check')) {
  assert.deepEqual(await readFile(target), generated, 'Next.js canary image is invalid or out of date');
} else {
  await writeFile(target, generated);
}

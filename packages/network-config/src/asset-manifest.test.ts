import { describe, expect, it } from 'vitest';
import { parseStaticAssetManifest } from './asset-manifest';

describe('parseStaticAssetManifest', () => {
  it('accepts portable assets with response metadata', () => {
    const manifest = {
      version: 1,
      assets: [
        {
          source: '.next/server/app/index.html',
          path: '/',
          status: 200,
          headers: { 'content-type': 'text/html', link: ['</styles.css>; rel=preload', '</app.js>; rel=preload'] },
        },
        { source: 'public/logo.svg', path: '/logo.svg', immutable: true },
      ],
    };

    expect(parseStaticAssetManifest(JSON.stringify(manifest))).toEqual(manifest);
  });

  it.each([
    { source: '../secret', path: '/secret' },
    { source: '/absolute', path: '/absolute' },
    { source: 'public/file.txt', path: 'missing-leading-slash' },
    { source: 'public/file.txt', path: '/file?query=true' },
    { source: 'public/file.txt', path: '/../../etc/passwd' },
    { source: 'public/file.txt', path: '/windows\\path' },
    { source: 'public/file.txt', path: '/ok\u0000hidden' },
    { source: 'public/file.txt', path: '/ok\r\nx-injected: true' },
    { source: 'public/file.txt', path: '/ok\u007f' },
    { source: 'public/file.txt', path: '/file', status: 99 },
    { source: 'public/file.txt', path: '/file', headers: { invalid: 42 } },
    { source: 'public/file.txt', path: '/file', headers: { 'invalid header': 'value' } },
    { source: 'public/file.txt', path: '/file', headers: { 'x-test\r\nx-injected': 'value' } },
    { source: 'public/file.txt', path: '/file', headers: { valid: 'value\r\nx-injected: true' } },
    { source: 'public/file.txt', path: '/file', headers: { valid: ['value', 'value\n'] } },
  ])('rejects an invalid asset entry %#', (asset) => {
    expect(parseStaticAssetManifest(JSON.stringify({ version: 1, assets: [asset] }))).toBeUndefined();
  });

  it('rejects duplicate URL paths', () => {
    expect(
      parseStaticAssetManifest(
        JSON.stringify({
          version: 1,
          assets: [
            { source: 'one.html', path: '/same' },
            { source: 'two.html', path: '/same' },
          ],
        })
      )
    ).toBeUndefined();
  });

  it('rejects malformed manifests', () => {
    expect(parseStaticAssetManifest('{invalid')).toBeUndefined();
    expect(parseStaticAssetManifest(JSON.stringify({ version: 2, assets: [] }))).toBeUndefined();
  });
});

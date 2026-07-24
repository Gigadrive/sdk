import { describe, expect, it } from 'vitest';
import { parseGigadriveNextBuildManifest } from './nextjs-manifest';

const imagePolicy = {
  localPatterns: [{ pathname: '/images/**' }],
  remotePatterns: [{ protocol: 'https', hostname: 'images.example.com', pathname: '/**' }],
  widths: [640, 1080],
  heights: [],
  qualities: [75],
  formats: ['image/webp'],
  minimumCacheTTL: 60,
  dangerouslyAllowSVG: false,
  contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  contentDispositionType: 'attachment',
  maximumRedirects: 3,
  maximumResponseBody: 52428800,
  variants: {},
};

const standaloneV2 = (overrides: Record<string, unknown> = {}) => ({
  version: 2,
  mode: 'standalone-v2',
  distDir: '.next',
  repoRootToProject: '.',
  nextVersion: '16.2.10',
  buildId: 'build-id',
  server: { maxDuration: 30, env: { FOO: 'bar' } },
  config: { basePath: '', trailingSlash: false, cacheComponents: true, images: imagePolicy },
  routing: {
    beforeMiddleware: [],
    beforeFiles: [],
    afterFiles: [],
    dynamicRoutes: [],
    onMatch: [],
    fallback: [],
    shouldNormalizeNextData: true,
    rsc: {},
  },
  outputs: {
    prerenders: [
      {
        id: 'isr',
        type: 'PRERENDER',
        pathname: '/isr',
        parentOutputId: 'app',
        groupId: 1,
        fallback: { filePath: '.next/server/app/isr.html', initialRevalidate: 5, postponedState: 'state' },
        config: { renderingMode: 'PARTIALLY_STATIC' },
      },
    ],
    staticAssets: [{ sourceDir: '.next/static', urlPrefix: '_next/static', immutable: true }],
  },
  ...overrides,
});

const parse = (value: unknown) => parseGigadriveNextBuildManifest(JSON.stringify(value));

describe('parseGigadriveNextBuildManifest', () => {
  it('accepts a V1 standalone manifest', () => {
    const manifest = {
      version: 1,
      output: 'standalone',
      distDir: '.next',
      repoRootToProject: 'apps/web',
      nextVersion: '15.5.0',
      buildId: 'build-id',
    };
    expect(parse(manifest)).toEqual(manifest);
  });

  it('accepts a V1 export manifest', () => {
    const manifest = {
      version: 1,
      output: 'export',
      distDir: '.next',
      repoRootToProject: '.',
      nextVersion: '15.5.0',
      buildId: 'build-id',
    };
    expect(parse(manifest)).toEqual(manifest);
  });

  it('accepts a standalone-v2 manifest with a static prefix and prerenders', () => {
    const manifest = standaloneV2();
    expect(parse(manifest)).toEqual(manifest);
  });

  it('accepts a minimal export manifest', () => {
    const manifest = {
      version: 2,
      mode: 'export',
      distDir: '.next',
      repoRootToProject: '.',
      nextVersion: '16.2.10',
      buildId: 'build-id',
    };
    expect(parse(manifest)).toEqual(manifest);
  });

  it('rejects the retired adapter-v2 mode', () => {
    expect(parse(standaloneV2({ mode: 'adapter-v2' }))).toBeUndefined();
  });

  it('rejects an unknown v2 mode', () => {
    expect(parse(standaloneV2({ mode: 'something-else' }))).toBeUndefined();
  });

  it('rejects path traversal in a static asset source directory', () => {
    expect(
      parse(
        standaloneV2({
          outputs: {
            prerenders: [],
            staticAssets: [{ sourceDir: '../secret', urlPrefix: '_next/static', immutable: true }],
          },
        })
      )
    ).toBeUndefined();
  });

  it('rejects an absolute static asset url prefix', () => {
    expect(
      parse(
        standaloneV2({
          outputs: {
            prerenders: [],
            staticAssets: [{ sourceDir: '.next/static', urlPrefix: '/_next/static', immutable: true }],
          },
        })
      )
    ).toBeUndefined();
  });

  it('rejects path traversal in a prerender fallback file path', () => {
    const manifest = standaloneV2();
    manifest.outputs.prerenders[0].fallback.filePath = '../outside.html';
    expect(parse(manifest)).toBeUndefined();
  });

  it('rejects a standalone-v2 manifest missing the server descriptor', () => {
    const { server: _server, ...withoutServer } = standaloneV2();
    expect(parse(withoutServer)).toBeUndefined();
  });

  it('rejects a standalone-v2 manifest missing routing', () => {
    const { routing: _routing, ...withoutRouting } = standaloneV2();
    expect(parse(withoutRouting)).toBeUndefined();
  });

  it('rejects a standalone-v2 manifest with an invalid image policy', () => {
    expect(
      parse(
        standaloneV2({
          config: { basePath: '', trailingSlash: false, cacheComponents: true, images: { widths: 'nope' } },
        })
      )
    ).toBeUndefined();
  });

  it('rejects invalid JSON', () => {
    expect(parseGigadriveNextBuildManifest('{not json')).toBeUndefined();
  });

  it('rejects an unknown version', () => {
    expect(
      parse({ version: 3, distDir: '.next', repoRootToProject: '.', nextVersion: '17.0.0', buildId: 'x' })
    ).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { parseGigadriveNextBuildManifest, parseGigadriveNextPrerenderManifest } from './nextjs-manifest';

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

  it('accepts sidecar references in a standalone-v2 manifest', () => {
    const manifest = standaloneV2({
      outputs: {
        prerenders: [],
        prerenderManifest: '.gigadrive/nextjs-prerenders.json',
        assetManifest: '.gigadrive/assets/nextjs.json',
        entryPagePaths: ['/', '/docs'],
        staticAssets: [{ sourceDir: '.next/static', urlPrefix: '_next/static', immutable: true }],
      },
    });
    expect(parse(manifest)).toEqual(manifest);
  });

  it('accepts middleware present with exact matcher conditions', () => {
    const middleware = {
      present: true,
      matchers: [
        {
          source: '/((?!api|_next).*)',
          sourceRegex: '^/((?!api|_next).*)$',
          has: [
            { type: 'header', key: 'x-tenant', value: 'public' },
            { type: 'host', value: 'example.com' },
          ],
          missing: [{ type: 'cookie', key: 'preview' }],
        },
      ],
    };
    const manifest = standaloneV2({ outputs: { ...standaloneV2().outputs, middleware } });
    expect(parse(manifest)).toEqual(manifest);
  });

  it('accepts explicit middleware absence', () => {
    const manifest = standaloneV2({
      outputs: { ...standaloneV2().outputs, middleware: { present: false, matchers: [] } },
    });
    expect(parse(manifest)).toEqual(manifest);
  });

  it('keeps backward compatibility with manifests that predate middleware discovery', () => {
    const manifest = standaloneV2();
    expect(manifest.outputs).not.toHaveProperty('middleware');
    expect(parse(manifest)).toEqual(manifest);
  });

  it.each([
    { present: false, matchers: [{ source: '/:path*', sourceRegex: '^/.*$' }] },
    { present: true, matchers: [{ source: '/:path*' }] },
    {
      present: true,
      matchers: [{ source: '/:path*', sourceRegex: '^/.*$', has: [{ type: 'header', value: 'missing-key' }] }],
    },
  ])('rejects invalid middleware discovery metadata %#', (middleware) => {
    expect(parse(standaloneV2({ outputs: { ...standaloneV2().outputs, middleware } }))).toBeUndefined();
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

  it('rejects unsafe sidecar paths', () => {
    expect(
      parse(
        standaloneV2({
          outputs: {
            prerenders: [],
            assetManifest: '../assets.json',
            staticAssets: [],
          },
        })
      )
    ).toBeUndefined();
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

describe('parseGigadriveNextPrerenderManifest', () => {
  it('accepts validated prerender entries', () => {
    const prerenders = standaloneV2().outputs.prerenders;
    const manifest = { version: 1, prerenders };
    expect(parseGigadriveNextPrerenderManifest(JSON.stringify(manifest))).toEqual(manifest);
  });

  it('rejects unsafe fallback paths', () => {
    const prerenders = standaloneV2().outputs.prerenders;
    prerenders[0].fallback.filePath = '../outside.html';
    expect(parseGigadriveNextPrerenderManifest(JSON.stringify({ version: 1, prerenders }))).toBeUndefined();
  });

  it.each([
    { pathname: 'relative' },
    { fallback: { initialStatus: '200' } },
    { fallback: { initialStatus: 99 } },
    { fallback: { initialHeaders: { 'invalid header': 'value' } } },
    { fallback: { initialHeaders: { valid: 'value\r\nx-injected: true' } } },
    { pprChain: { headers: { valid: 'value\n' } } },
    { config: { allowHeader: [42] } },
  ])('rejects invalid prerender metadata %#', (override) => {
    const prerender = { ...standaloneV2().outputs.prerenders[0], ...override };
    expect(
      parseGigadriveNextPrerenderManifest(JSON.stringify({ version: 1, prerenders: [prerender] }))
    ).toBeUndefined();
  });
});

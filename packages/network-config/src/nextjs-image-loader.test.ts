import { describe, expect, it } from 'vitest';
import gigadriveNextImageLoader from './nextjs-image-loader';

describe('gigadriveNextImageLoader', () => {
  it('creates a same-host canonical URL for local images', () => {
    expect(gigadriveNextImageLoader({ src: '/images/photo.png', width: 1080, quality: 80 })).toBe(
      '/_gigadrive/image/%2Fimages%2Fphoto.png/photo.png?width=1080&quality=80'
    );
  });

  it('retains a filename hint for extensionless remote images', () => {
    expect(gigadriveNextImageLoader({ src: 'https://images.example.com/avatar?id=1', width: 64 })).toBe(
      '/_gigadrive/image/https%3A%2F%2Fimages.example.com%2Favatar%3Fid%3D1/avatar.png?width=64'
    );
  });

  it('uses an optimizer-recognized hint for sources with non-image extensions', () => {
    expect(gigadriveNextImageLoader({ src: 'https://images.example.com/render.php?id=1', width: 64 })).toBe(
      '/_gigadrive/image/https%3A%2F%2Fimages.example.com%2Frender.php%3Fid%3D1/render.php.png?width=64'
    );
  });

  it('serves oversized source URLs unoptimized instead of emitting an oversized optimizer URL', () => {
    const src = `https://images.example.com/signed.png?token=${'a'.repeat(3000)}`;

    expect(gigadriveNextImageLoader({ src, width: 640 })).toBe(src);
  });

  // Next appends `?dpl=<deploymentId>` to local sources when a deployment id is
  // configured. The optimizer resolves the deployment from the hostname and
  // never reads `dpl`, so a per-deploy URL only invalidates the CDN's image
  // cache on every release.
  it('strips the dpl marker so optimizer URLs stay stable across deploys', () => {
    expect(
      gigadriveNextImageLoader({ src: '/_next/static/media/logo.1uniit1qnbxaq.png?dpl=dpl_123', width: 256 })
    ).toBe('/_gigadrive/image/%2F_next%2Fstatic%2Fmedia%2Flogo.1uniit1qnbxaq.png/logo.1uniit1qnbxaq.png?width=256');
  });

  it('keeps other local query parameters while stripping dpl', () => {
    expect(gigadriveNextImageLoader({ src: '/images/photo.png?v=2&dpl=dpl_123', width: 640 })).toBe(
      '/_gigadrive/image/%2Fimages%2Fphoto.png%3Fv%3D2/photo.png?width=640'
    );
  });

  it('leaves remote sources untouched by the dpl strip', () => {
    expect(gigadriveNextImageLoader({ src: 'https://images.example.com/a.png?dpl=x', width: 64 })).toBe(
      '/_gigadrive/image/https%3A%2F%2Fimages.example.com%2Fa.png%3Fdpl%3Dx/a.png?width=64'
    );
  });
});

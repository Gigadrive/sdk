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
      '/_gigadrive/image/https%3A%2F%2Fimages.example.com%2Favatar%3Fid%3D1/avatar.image?width=64'
    );
  });
});

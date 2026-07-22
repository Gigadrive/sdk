import type { NextConfig } from 'next';

const config: NextConfig = {
  cacheComponents: true,
  turbopack: {
    root: process.cwd(),
  },
  images: {
    deviceSizes: [64, 128],
    imageSizes: [32],
    qualities: [75],
    formats: ['image/avif', 'image/webp'],
  },
};

export default config;

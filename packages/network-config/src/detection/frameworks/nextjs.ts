import type { FrameworkDefinition } from '../types';

export const nextjs: FrameworkDefinition = {
  slug: 'nextjs',
  name: 'Next.js',
  language: 'node',
  detectors: [{ matchPackage: 'next' }],
  priority: 100,
  getDefaultConfig: () => ({
    runtime: 'node-22',
    memory: 256,
    maxDuration: 30,
    streaming: true,
    commands: ['next build'],
    entrypoint: '.next/standalone/server.js',
    assetsDir: '.next/static',
    populateAssetCache: true,
    routes: [{ source: '/*', destination: '.next/standalone/server.js' }],
    environmentVariables: { NODE_ENV: 'production' },
  }),
};

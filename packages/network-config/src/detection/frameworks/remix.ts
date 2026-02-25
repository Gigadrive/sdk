import type { FrameworkDefinition } from '../types';

export const remix: FrameworkDefinition = {
  slug: 'remix',
  name: 'Remix',
  language: 'node',
  detectors: [{ matchPackage: '@remix-run/dev' }],
  priority: 90,
  getDefaultConfig: () => ({
    runtime: 'node-22',
    memory: 256,
    maxDuration: 30,
    streaming: true,
    commands: ['remix build'],
    entrypoint: 'build/server/index.js',
    assetsDir: 'build/client',
    populateAssetCache: true,
    routes: [{ source: '/*', destination: 'build/server/index.js' }],
    environmentVariables: { NODE_ENV: 'production' },
  }),
};

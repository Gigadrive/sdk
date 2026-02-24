import type { FrameworkDefinition } from '../types';

export const astro: FrameworkDefinition = {
  slug: 'astro',
  name: 'Astro',
  language: 'node',
  detectors: [{ matchPackage: 'astro' }],
  priority: 85,
  getDefaultConfig: () => ({
    runtime: 'node-22',
    memory: 256,
    maxDuration: 30,
    streaming: true,
    commands: ['astro build'],
    entrypoint: 'dist/server/entry.mjs',
    assetsDir: 'dist/client',
    populateAssetCache: true,
    routes: [{ source: '/*', destination: 'dist/server/entry.mjs' }],
    environmentVariables: { NODE_ENV: 'production' },
  }),
};

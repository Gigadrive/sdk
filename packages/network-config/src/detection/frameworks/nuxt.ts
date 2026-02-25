import type { FrameworkDefinition } from '../types';

export const nuxt: FrameworkDefinition = {
  slug: 'nuxt',
  name: 'Nuxt',
  language: 'node',
  detectors: [{ matchPackage: 'nuxt' }],
  priority: 95,
  getDefaultConfig: () => ({
    runtime: 'node-22',
    memory: 256,
    maxDuration: 30,
    streaming: true,
    commands: ['nuxt build'],
    entrypoint: '.output/server/index.mjs',
    assetsDir: '.output/public',
    populateAssetCache: true,
    routes: [{ source: '/*', destination: '.output/server/index.mjs' }],
    environmentVariables: { NODE_ENV: 'production', NITRO_PRESET: 'node-server' },
  }),
};

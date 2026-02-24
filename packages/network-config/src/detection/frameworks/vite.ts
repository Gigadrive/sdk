import type { FrameworkDefinition } from '../types';

export const vite: FrameworkDefinition = {
  slug: 'vite',
  name: 'Vite',
  language: 'node',
  detectors: [{ matchPackage: 'vite' }],
  priority: 5,
  getDefaultConfig: () => ({
    runtime: 'node-22',
    memory: 128,
    maxDuration: 30,
    streaming: false,
    commands: ['vite build'],
    entrypoint: 'dist/index.html',
    assetsDir: 'dist',
    populateAssetCache: true,
    routes: [],
    environmentVariables: { NODE_ENV: 'production' },
  }),
};

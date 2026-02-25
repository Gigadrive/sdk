import type { FrameworkDefinition } from '../types';

export const sveltekit: FrameworkDefinition = {
  slug: 'sveltekit',
  name: 'SvelteKit',
  language: 'node',
  detectors: [{ matchPackage: '@sveltejs/kit' }],
  priority: 90,
  getDefaultConfig: () => ({
    runtime: 'node-22',
    memory: 256,
    maxDuration: 30,
    streaming: true,
    commands: ['vite build'],
    entrypoint: 'build/index.js',
    assetsDir: 'build/client',
    populateAssetCache: true,
    routes: [{ source: '/*', destination: 'build/index.js' }],
    environmentVariables: { NODE_ENV: 'production' },
  }),
};

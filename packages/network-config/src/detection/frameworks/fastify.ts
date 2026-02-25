import type { FrameworkDefinition } from '../types';

export const fastify: FrameworkDefinition = {
  slug: 'fastify',
  name: 'Fastify',
  language: 'node',
  detectors: [{ matchPackage: 'fastify' }],
  priority: 40,
  getDefaultConfig: () => ({
    runtime: 'node-22',
    memory: 128,
    maxDuration: 30,
    streaming: true,
    commands: [],
    entrypoint: 'src/index.ts',
    routes: [{ source: '/*', destination: 'src/index.ts' }],
    environmentVariables: { NODE_ENV: 'production' },
  }),
};

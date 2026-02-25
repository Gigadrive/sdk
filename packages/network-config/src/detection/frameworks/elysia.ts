import type { FrameworkDefinition } from '../types';

export const elysia: FrameworkDefinition = {
  slug: 'elysia',
  name: 'Elysia',
  language: 'node',
  detectors: [{ matchPackage: 'elysia' }],
  priority: 45,
  getDefaultConfig: () => ({
    runtime: 'bun-1',
    memory: 128,
    maxDuration: 30,
    streaming: true,
    commands: [],
    entrypoint: 'src/index.ts',
    routes: [{ source: '/*', destination: 'src/index.ts' }],
    environmentVariables: { NODE_ENV: 'production' },
  }),
};

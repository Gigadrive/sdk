import type { FrameworkDefinition } from '../types';
import { resolveNodeServerEntrypoint } from './resolve-node-entrypoint';

export const hono: FrameworkDefinition = {
  slug: 'hono',
  name: 'Hono',
  language: 'node',
  detectors: [{ matchPackage: 'hono' }],
  priority: 50,
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
  refineDefaultConfig: resolveNodeServerEntrypoint,
};

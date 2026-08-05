import type { FrameworkDefinition } from '../types';
import { resolveNodeServerEntrypoint } from './resolve-node-entrypoint';

export const express: FrameworkDefinition = {
  slug: 'express',
  name: 'Express',
  language: 'node',
  detectors: [{ matchPackage: 'express' }],
  priority: 10,
  getDefaultConfig: () => ({
    runtime: 'node-22',
    memory: 128,
    maxDuration: 30,
    streaming: true,
    commands: [],
    entrypoint: 'index.js',
    routes: [{ source: '/*', destination: 'index.js' }],
    environmentVariables: { NODE_ENV: 'production' },
  }),
  refineDefaultConfig: resolveNodeServerEntrypoint,
};

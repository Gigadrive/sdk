import type { FrameworkDefinition } from '../types';

export const nestjs: FrameworkDefinition = {
  slug: 'nestjs',
  name: 'NestJS',
  language: 'node',
  detectors: [{ matchPackage: '@nestjs/core' }],
  priority: 90,
  getDefaultConfig: () => ({
    runtime: 'node-22',
    memory: 256,
    maxDuration: 30,
    streaming: true,
    commands: ['nest build'],
    entrypoint: 'dist/main.js',
    routes: [{ source: '/*', destination: 'dist/main.js' }],
    environmentVariables: { NODE_ENV: 'production' },
  }),
};

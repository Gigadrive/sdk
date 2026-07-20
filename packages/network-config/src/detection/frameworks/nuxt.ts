import { FileSystem } from '@effect/platform';
import { Effect } from 'effect';
import type { FrameworkDefinition } from '../types';

const isVercelBuildOutputV3 = (content: string): boolean => {
  try {
    const config: unknown = JSON.parse(content);
    return (
      typeof config === 'object' &&
      config !== null &&
      'version' in config &&
      typeof config.version === 'number' &&
      config.version >= 3
    );
  } catch {
    return false;
  }
};

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
  refineDefaultConfig: (defaults, projectFolder) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const buildOutputConfig = yield* fs
        .readFileString(`${projectFolder}/.vercel/output/config.json`)
        .pipe(Effect.catchAll(() => Effect.succeed(undefined)));

      if (!buildOutputConfig || !isVercelBuildOutputV3(buildOutputConfig)) {
        return defaults;
      }

      return {
        ...defaults,
        entrypoint: undefined,
        assetsDir: '.vercel/output/static',
        routes: [],
        environmentVariables: { ...defaults.environmentVariables, NITRO_PRESET: 'vercel' },
      };
    }),
};

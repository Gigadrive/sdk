import type { FrameworkDefinition } from '../types';

export const laravel: FrameworkDefinition = {
  slug: 'laravel',
  name: 'Laravel',
  language: 'php',
  detectors: [{ matchPackage: 'laravel/framework' }, { path: 'artisan' }],
  priority: 80,
  getDefaultConfig: () => ({
    runtime: 'php-84',
    memory: 256,
    maxDuration: 30,
    streaming: false,
    commands: ['composer require bref/laravel-bridge --update-with-dependencies', 'bun install', 'bun run build'],
    entrypoint: 'public/index.php',
    assetsDir: 'public',
    populateAssetCache: true,
    excludeFiles: ['tests/', 'storage/', '.ddev', 'node_modules/'],
    routes: [{ source: '/*', destination: 'public/index.php' }],
    environmentVariables: {
      APP_NAME: 'Laravel',
      APP_ENV: 'production',
      APP_DEBUG: 'false',
      LOG_CHANNEL: 'stderr',
      LOG_DEPRECATIONS_CHANNEL: 'stderr',
      LOG_LEVEL: 'debug',
      BROADCAST_DRIVER: 'log',
      SESSION_DRIVER: 'cookie',
    },
  }),
};

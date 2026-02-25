import type { FrameworkDefinition } from '../types';

export const symfony: FrameworkDefinition = {
  slug: 'symfony',
  name: 'Symfony',
  language: 'php',
  detectors: [{ matchPackage: 'symfony/framework-bundle' }, { path: 'bin/console' }],
  priority: 80,
  getDefaultConfig: () => ({
    runtime: 'php-84',
    memory: 512,
    maxDuration: 30,
    streaming: false,
    installCommand: 'composer install --prefer-dist --optimize-autoloader --no-dev',
    commands: ['bun install', 'bun run build'],
    entrypoint: 'public/index.php',
    assetsDir: 'public',
    populateAssetCache: true,
    excludeFiles: ['tests/*', '.ddev', 'var'],
    symlinks: { var: '/tmp' },
    routes: [{ source: '/*', destination: 'public/index.php' }],
    environmentVariables: {
      APP_ENV: 'prod',
      APP_DEBUG: 'false',
      APP_SECRET: 'please_change_this_value_in_your_settings',
      MESSENGER_TRANSPORT_DSN: 'doctrine://default?auto_setup=0',
    },
  }),
};

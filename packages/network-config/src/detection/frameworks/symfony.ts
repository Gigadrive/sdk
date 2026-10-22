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
    routes: [{ source: '/*', destination: 'public/index.php' }],
    // The kernel's cache and log directories. A symlink to /tmp used to stand
    // in for them, which the build rejected as pointing outside the project.
    package: { writablePaths: ['var/cache', 'var/log'] },
    environmentVariables: {
      APP_ENV: 'prod',
      APP_DEBUG: 'false',
      MESSENGER_TRANSPORT_DSN: 'doctrine://default?auto_setup=0',
    },
  }),
};

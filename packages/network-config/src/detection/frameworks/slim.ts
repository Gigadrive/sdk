import type { FrameworkDefinition } from '../types';
import { phpFrontControllerDefaults } from './php-front-controller';

export const slim: FrameworkDefinition = {
  slug: 'slim',
  name: 'Slim',
  language: 'php',
  detectors: [{ matchPackage: 'slim/slim' }, { path: 'public/index.php' }],
  priority: 75,
  getDefaultConfig: () =>
    phpFrontControllerDefaults({
      documentRoot: 'public',
      // slim/slim-skeleton logs to logs/ and caches the container and routes in var/cache.
      writablePaths: ['logs', 'var/cache'],
      excludeFiles: ['tests/', 'logs/', 'var/'],
    }),
};

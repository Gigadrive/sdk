import type { FrameworkDefinition } from '../types';
import { phpFrontControllerDefaults } from './php-front-controller';

export const cakephp: FrameworkDefinition = {
  slug: 'cakephp',
  name: 'CakePHP',
  language: 'php',
  detectors: [{ matchPackage: 'cakephp/cakephp' }, { path: 'webroot/index.php' }],
  priority: 80,
  getDefaultConfig: () =>
    phpFrontControllerDefaults({
      documentRoot: 'webroot',
      // config/paths.php puts TMP and LOGS inside the project.
      writablePaths: [
        'tmp/cache/models',
        'tmp/cache/persistent',
        'tmp/cache/views',
        'tmp/sessions',
        'tmp/tests',
        'logs',
      ],
      excludeFiles: ['tests/', 'tmp/', 'logs/'],
    }),
};

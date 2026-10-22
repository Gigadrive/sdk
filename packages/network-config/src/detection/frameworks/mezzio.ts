import type { FrameworkDefinition } from '../types';
import { phpFrontControllerDefaults } from './php-front-controller';

export const mezzio: FrameworkDefinition = {
  slug: 'mezzio',
  name: 'Mezzio',
  language: 'php',
  detectors: [{ matchPackage: 'mezzio/mezzio' }, { path: 'public/index.php' }],
  priority: 80,
  getDefaultConfig: () =>
    phpFrontControllerDefaults({
      documentRoot: 'public',
      // config/config.php writes the merged config cache here.
      writablePaths: ['data/cache'],
      excludeFiles: ['test/', 'data/cache/'],
    }),
};

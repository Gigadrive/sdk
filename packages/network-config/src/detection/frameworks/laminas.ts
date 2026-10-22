import type { FrameworkDefinition } from '../types';
import { phpFrontControllerDefaults } from './php-front-controller';

export const laminas: FrameworkDefinition = {
  slug: 'laminas',
  name: 'Laminas MVC',
  language: 'php',
  detectors: [{ matchPackage: 'laminas/laminas-mvc' }, { path: 'public/index.php' }],
  priority: 80,
  getDefaultConfig: () =>
    phpFrontControllerDefaults({
      documentRoot: 'public',
      // The merged-config and module-map caches of the skeleton.
      writablePaths: ['data/cache'],
      excludeFiles: ['test/', 'data/cache/'],
    }),
};

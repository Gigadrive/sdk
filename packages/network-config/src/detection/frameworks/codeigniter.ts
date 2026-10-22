import type { FrameworkDefinition } from '../types';
import { phpFrontControllerDefaults } from './php-front-controller';

export const codeigniter: FrameworkDefinition = {
  slug: 'codeigniter',
  name: 'CodeIgniter',
  language: 'php',
  detectors: [{ matchPackage: 'codeigniter4/framework' }, { path: 'spark' }],
  priority: 80,
  getDefaultConfig: () =>
    phpFrontControllerDefaults({
      documentRoot: 'public',
      // WRITEPATH: the cache, file session and log handlers write below it.
      writablePaths: ['writable/cache', 'writable/debugbar', 'writable/logs', 'writable/session', 'writable/uploads'],
      excludeFiles: ['tests/', 'writable/'],
      environmentVariables: { CI_ENVIRONMENT: 'production' },
    }),
};

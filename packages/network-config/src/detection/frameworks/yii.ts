import type { FrameworkDefinition } from '../types';
import { phpFrontControllerDefaults } from './php-front-controller';

export const yii: FrameworkDefinition = {
  slug: 'yii',
  name: 'Yii 2',
  language: 'php',
  detectors: [{ matchPackage: 'yiisoft/yii2' }, { path: 'web/index.php' }],
  priority: 80,
  getDefaultConfig: () =>
    phpFrontControllerDefaults({
      documentRoot: 'web',
      // @runtime holds cache, logs and sessions; the asset manager publishes
      // bundles from vendor/ into web/assets when a page first uses them.
      writablePaths: ['runtime', 'web/assets'],
      excludeFiles: ['tests/', 'runtime/', 'web/assets/'],
    }),
};

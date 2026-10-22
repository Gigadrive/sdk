import { FileSystem, Path } from '@effect/platform';
import { Effect } from 'effect';
import type { FrameworkDefaultConfig, FrameworkDefinition } from '../types';
import { phpFrontControllerDefaults } from './php-front-controller';

/** Kept out of the package and off the edge. */
const COMPOSER_FILES = ['composer.json', 'composer.lock'];

/** Document roots tried in order; the first holding an `index.php` wins. */
const DOCUMENT_ROOTS = ['public', 'web', 'webroot', 'public_html', 'htdocs', '.'];

/**
 * Picks the document root of a PHP project without a recognized framework:
 * the first of {@link DOCUMENT_ROOTS} that holds an `index.php`, or the
 * project root when none does.
 */
const refinePhpDocumentRoot = (defaults: FrameworkDefaultConfig, projectFolder: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* Path.Path;
    for (const documentRoot of DOCUMENT_ROOTS) {
      const frontController = pathService.join(projectFolder, documentRoot, 'index.php');
      if (yield* fs.exists(frontController).pipe(Effect.catchAll(() => Effect.succeed(false)))) {
        return phpFrontControllerDefaults({ documentRoot, excludeFiles: COMPOSER_FILES });
      }
    }
    return defaults;
  });

const getDefaultConfig = () => phpFrontControllerDefaults({ documentRoot: '.', excludeFiles: COMPOSER_FILES });

/**
 * A Composer project that no specific PHP framework claimed. Ranked above the
 * Vite preset, so a PHP application with a Vite front end still runs its PHP.
 */
export const php: FrameworkDefinition = {
  slug: 'php',
  name: 'PHP',
  language: 'php',
  detectors: [{ path: 'composer.json' }],
  priority: 7,
  getDefaultConfig,
  refineDefaultConfig: refinePhpDocumentRoot,
};

/**
 * Plain PHP files without Composer, one definition per document root because
 * detectors only combine with AND. The refinement still picks the first root
 * in {@link DOCUMENT_ROOTS} order, whichever definition matched.
 */
export const phpSites: FrameworkDefinition[] = DOCUMENT_ROOTS.map((documentRoot) => ({
  slug: 'php-site',
  name: 'PHP',
  language: 'php',
  detectors: [{ path: documentRoot === '.' ? 'index.php' : `${documentRoot}/index.php` }],
  priority: 6,
  getDefaultConfig,
  refineDefaultConfig: refinePhpDocumentRoot,
}));

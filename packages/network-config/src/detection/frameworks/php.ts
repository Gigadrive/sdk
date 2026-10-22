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

/** The front controller for one candidate document root. */
const frontControllerPath = (documentRoot: string) =>
  documentRoot === '.' ? 'index.php' : `${documentRoot}/index.php`;

/**
 * A Composer project that no specific PHP framework claimed, one definition
 * per document root because detectors only combine with AND. A Composer
 * project without a front controller in any of them is not detected at all.
 * Ranked above the Vite preset, so a PHP application with a Vite front end
 * still runs its PHP.
 */
export const phpComposerProjects: FrameworkDefinition[] = DOCUMENT_ROOTS.map((documentRoot) => ({
  slug: 'php',
  name: 'PHP',
  language: 'php',
  detectors: [{ path: 'composer.json' }, { path: frontControllerPath(documentRoot) }],
  priority: 7,
  getDefaultConfig,
  refineDefaultConfig: refinePhpDocumentRoot,
}));

/**
 * Plain PHP files without Composer, one definition per document root. There
 * is no manifest, so there is no install step either.
 */
export const phpSites: FrameworkDefinition[] = DOCUMENT_ROOTS.map((documentRoot) => ({
  slug: 'php-site',
  name: 'PHP',
  language: 'php',
  detectors: [{ path: frontControllerPath(documentRoot) }],
  priority: 6,
  getDefaultConfig: () => ({ ...getDefaultConfig(), installCommand: '' }),
  refineDefaultConfig: (defaults, projectFolder) =>
    refinePhpDocumentRoot(defaults, projectFolder).pipe(Effect.map((refined) => ({ ...refined, installCommand: '' }))),
}));

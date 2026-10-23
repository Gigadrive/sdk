import type { FrameworkDefaultConfig } from '../types';

/**
 * Defaults for a PHP application served by one front controller in its
 * document root, the shape every supported PHP framework shares.
 *
 * The document root is published as static assets (PHP files in it are
 * skipped, so they run instead of being served), every other path reaches the
 * front controller, and `writablePaths` become directories the application can
 * write its cache, sessions and logs to at runtime. Without them a framework
 * that writes inside its own tree fails on the first request. The runtime is
 * `php-84` until `composer.json` `require.php` says otherwise (see
 * `withComposerPhpRuntime`).
 *
 * @param options.documentRoot - Directory holding the front controller, relative
 *   to the project root. `.` publishes the project root itself.
 * @param options.writablePaths - Directories the framework writes to at runtime.
 * @param options.excludeFiles - Paths kept out of the package and the assets.
 */
export const phpFrontControllerDefaults = ({
  documentRoot,
  writablePaths = [],
  excludeFiles = [],
  memory = 256,
  environmentVariables = {},
}: {
  documentRoot: string;
  writablePaths?: string[];
  excludeFiles?: string[];
  memory?: number;
  environmentVariables?: Record<string, string>;
}): FrameworkDefaultConfig => {
  const entrypoint = documentRoot === '.' ? 'index.php' : `${documentRoot}/index.php`;
  return {
    runtime: 'php-84',
    memory,
    maxDuration: 30,
    streaming: false,
    commands: [],
    entrypoint,
    assetsDir: documentRoot,
    excludeFiles: ['.ddev', 'node_modules/', ...excludeFiles],
    routes: [{ source: '/*', destination: entrypoint }],
    environmentVariables,
    ...(writablePaths.length > 0 ? { package: { writablePaths } } : {}),
  };
};

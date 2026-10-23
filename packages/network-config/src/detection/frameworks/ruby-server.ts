import { FileSystem, Path } from '@effect/platform';
import { Effect } from 'effect';
import type { FrameworkDefaultConfig } from '../types';
import { DEFAULT_RUBY_RUNTIME } from './ruby-runtime';

/**
 * Defaults for a Ruby application served by a Rack server, the shape every
 * Ruby server preset shares.
 *
 * The entrypoint is normally the rackup file, `config.ru`; the platform's
 * launcher runs an entrypoint ending in `.ru` as a rackup file and one ending
 * in `.rb` as a classic Sinatra-style script. Every request reaches it through
 * a streaming route, since it is proxied to a real server. `public/` is
 * published as static assets (see {@link refineRubyPublicDirectory}), and
 * `writablePaths` become directories the application can write its cache,
 * pids and logs to at runtime. The runtime is `ruby-34` until the project
 * names a Ruby version (see `withRubyRuntime`).
 *
 * @param options.entrypoint - Rackup file or script, relative to the project root.
 * @param options.commands - Build commands run after `bundle install`.
 * @param options.writablePaths - Directories the framework writes to at runtime.
 * @param options.excludeFiles - Paths kept out of the function package.
 */
export const rubyServerDefaults = ({
  entrypoint = 'config.ru',
  memory = 256,
  commands = [],
  environmentVariables,
  excludeFiles,
  writablePaths = [],
}: {
  entrypoint?: string;
  memory?: number;
  commands?: string[];
  environmentVariables: Record<string, string>;
  excludeFiles?: string[];
  writablePaths?: string[];
}): FrameworkDefaultConfig => ({
  runtime: DEFAULT_RUBY_RUNTIME,
  memory,
  maxDuration: 30,
  streaming: true,
  commands,
  entrypoint,
  assetsDir: 'public',
  populateAssetCache: true,
  routes: [{ source: '/*', destination: entrypoint }],
  environmentVariables,
  ...(excludeFiles ? { excludeFiles } : {}),
  ...(writablePaths.length > 0 ? { package: { writablePaths } } : {}),
});

/**
 * Drops the static asset directory from Ruby server defaults when the project
 * has none, so an application without a `public/` directory publishes no
 * assets instead of declaring a directory that does not exist.
 */
export const refineRubyPublicDirectory = Effect.fn('refineRubyPublicDirectory')(function* (
  defaults: FrameworkDefaultConfig,
  projectFolder: string
) {
  if (!defaults.assetsDir) {
    return defaults;
  }
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const exists = yield* fs
    .exists(pathService.join(projectFolder, defaults.assetsDir))
    .pipe(Effect.catchAll(() => Effect.succeed(false)));
  if (exists) {
    return defaults;
  }
  const withoutAssets = { ...defaults };
  delete withoutAssets.assetsDir;
  delete withoutAssets.populateAssetCache;
  return withoutAssets;
});

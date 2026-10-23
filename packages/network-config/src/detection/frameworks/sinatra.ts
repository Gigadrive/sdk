import { FileSystem, Path } from '@effect/platform';
import { Effect } from 'effect';
import type { FrameworkDefaultConfig, FrameworkDefinition } from '../types';
import { refineRubyPublicDirectory, rubyServerDefaults } from './ruby-server';

/**
 * Entrypoints tried in order: the rackup file of a modular application, then
 * the script of a classic one, which the launcher requires and runs as
 * `Sinatra::Application`.
 */
const SINATRA_ENTRYPOINTS = ['config.ru', 'app.rb', 'main.rb', 'server.rb', 'application.rb'];

/** Picks the first entrypoint of {@link SINATRA_ENTRYPOINTS} that exists, and routes to it. */
const refineSinatraEntrypoint = Effect.fn('refineSinatraEntrypoint')(function* (
  defaults: FrameworkDefaultConfig,
  projectFolder: string
) {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const entrypoint = yield* Effect.findFirst(SINATRA_ENTRYPOINTS, (file) =>
    fs.exists(pathService.join(projectFolder, file)).pipe(Effect.catchAll(() => Effect.succeed(false)))
  );
  const withPublicDirectory = yield* refineRubyPublicDirectory(defaults, projectFolder);
  return entrypoint._tag === 'Some'
    ? {
        ...withPublicDirectory,
        entrypoint: entrypoint.value,
        routes: [{ source: '/*', destination: entrypoint.value }],
      }
    : withPublicDirectory;
});

export const sinatra: FrameworkDefinition = {
  slug: 'sinatra',
  name: 'Sinatra',
  language: 'ruby',
  detectors: [{ matchPackage: 'sinatra' }],
  priority: 60,
  getDefaultConfig: () =>
    rubyServerDefaults({ environmentVariables: { APP_ENV: 'production', RACK_ENV: 'production' } }),
  refineDefaultConfig: refineSinatraEntrypoint,
};

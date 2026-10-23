import { Effect } from 'effect';
import { generatedSecret } from '../generated-secret';
import { readDependencies } from '../read-dependencies';
import type { FrameworkDefaultConfig, FrameworkDefinition } from '../types';
import { refineRubyPublicDirectory, rubyServerDefaults } from './ruby-server';

/** Gems that give a Rails application an `assets:precompile` task. */
const ASSET_PIPELINE_GEMS = ['propshaft', 'sprockets', 'sprockets-rails'];

/**
 * Precompiles assets when the application has an asset pipeline. An API-only
 * application has neither Propshaft nor Sprockets, and no `assets:precompile`
 * task to run. `SECRET_KEY_BASE_DUMMY` lets the task boot the application
 * without the real secret, which only exists at runtime.
 */
const refineRailsAssets = Effect.fn('refineRailsAssets')(function* (
  defaults: FrameworkDefaultConfig,
  projectFolder: string
) {
  const gems = yield* readDependencies(projectFolder, 'ruby').pipe(
    Effect.catchAll(() => Effect.succeed(new Set<string>()))
  );
  const withPublicDirectory = yield* refineRubyPublicDirectory(defaults, projectFolder);
  return ASSET_PIPELINE_GEMS.some((gem) => gems.has(gem))
    ? {
        ...withPublicDirectory,
        commands: [...withPublicDirectory.commands, 'SECRET_KEY_BASE_DUMMY=1 bundle exec rails assets:precompile'],
      }
    : withPublicDirectory;
});

export const rails: FrameworkDefinition = {
  slug: 'rails',
  name: 'Ruby on Rails',
  language: 'ruby',
  // `railties` is in every Rails application's Gemfile.lock, including ones
  // that require individual Rails gems instead of `rails`.
  detectors: [{ matchPackage: 'railties' }, { path: 'config/application.rb' }],
  priority: 80,
  getDefaultConfig: () =>
    rubyServerDefaults({
      memory: 512,
      excludeFiles: ['tmp/', 'log/', 'storage/', 'test/', 'spec/', 'node_modules/', '.git/'],
      // tmp/, log/ and storage/ are excluded, so the directories Rails writes
      // caches, pids, sockets, logs and Active Storage files to are created empty.
      writablePaths: ['tmp/cache', 'tmp/pids', 'tmp/sockets', 'tmp/storage', 'log', 'storage'],
      environmentVariables: {
        RAILS_ENV: 'production',
        RACK_ENV: 'production',
        // Signs and encrypts cookies and sessions; Rails refuses to boot in production without it.
        SECRET_KEY_BASE: generatedSecret('hex'),
        RAILS_LOG_TO_STDOUT: '1',
        RAILS_SERVE_STATIC_FILES: '1',
        RAILS_MAX_THREADS: '5',
      },
    }),
  refineDefaultConfig: refineRailsAssets,
};

/**
 * Rails applications, in priority order: one with a `Gemfile.lock` (which
 * lists `railties`), and one whose `Gemfile` declares `rails` but has no
 * lockfile yet.
 */
export const railsPresets: FrameworkDefinition[] = [
  rails,
  { ...rails, detectors: [{ matchPackage: 'rails' }, { path: 'config/application.rb' }] },
];

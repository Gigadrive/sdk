import { Effect } from 'effect';
import { readDependencies } from '../read-dependencies';
import type { FrameworkDefaultConfig, FrameworkDefinition } from '../types';
import { refineRubyPublicDirectory, rubyServerDefaults } from './ruby-server';

/** Compiles assets when the application uses `hanami-assets`. */
const refineHanamiAssets = Effect.fn('refineHanamiAssets')(function* (
  defaults: FrameworkDefaultConfig,
  projectFolder: string
) {
  const gems = yield* readDependencies(projectFolder, 'ruby').pipe(
    Effect.catchAll(() => Effect.succeed(new Set<string>()))
  );
  const withPublicDirectory = yield* refineRubyPublicDirectory(defaults, projectFolder);
  return gems.has('hanami-assets')
    ? { ...withPublicDirectory, commands: [...withPublicDirectory.commands, 'bundle exec hanami assets compile'] }
    : withPublicDirectory;
});

export const hanami: FrameworkDefinition = {
  slug: 'hanami',
  name: 'Hanami',
  language: 'ruby',
  detectors: [{ matchPackage: 'hanami' }, { path: 'config.ru' }],
  priority: 75,
  getDefaultConfig: () =>
    rubyServerDefaults({
      excludeFiles: ['tmp/', 'log/', 'spec/', 'node_modules/', '.git/'],
      writablePaths: ['tmp', 'log'],
      environmentVariables: { HANAMI_ENV: 'production', RACK_ENV: 'production' },
    }),
  refineDefaultConfig: refineHanamiAssets,
};

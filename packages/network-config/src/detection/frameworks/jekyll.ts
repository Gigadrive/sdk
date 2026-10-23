import type { FrameworkDefinition } from '../types';
import { DEFAULT_RUBY_RUNTIME } from './ruby-runtime';

/**
 * A Jekyll site: built into `_site` and published as static files only. The
 * runtime picks the Ruby the build runs on; there is no function.
 */
export const jekyll: FrameworkDefinition = {
  slug: 'jekyll',
  name: 'Jekyll',
  language: 'ruby',
  detectors: [{ matchPackage: 'jekyll' }],
  priority: 70,
  getDefaultConfig: () => ({
    runtime: DEFAULT_RUBY_RUNTIME,
    memory: 128,
    maxDuration: 30,
    streaming: false,
    commands: ['bundle exec jekyll build'],
    assetsDir: '_site',
    populateAssetCache: true,
    routes: [],
    environmentVariables: { JEKYLL_ENV: 'production' },
  }),
};

/**
 * Jekyll sites, in priority order: one whose gems include `jekyll`, and a
 * GitHub Pages site whose `Gemfile` declares only `github-pages` and has no
 * lockfile listing the `jekyll` it depends on.
 */
export const jekyllPresets: FrameworkDefinition[] = [
  jekyll,
  { ...jekyll, detectors: [{ matchPackage: 'github-pages' }] },
];

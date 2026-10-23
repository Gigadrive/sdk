import type { FrameworkDefinition } from '../types';
import { DEFAULT_RUBY_RUNTIME } from './ruby-runtime';

/**
 * A Bridgetown site: `bin/bridgetown deploy` builds the front end and the
 * site into `output`, which is published as static files only. The runtime
 * picks the Ruby the build runs on; there is no function.
 */
export const bridgetown: FrameworkDefinition = {
  slug: 'bridgetown',
  name: 'Bridgetown',
  language: 'ruby',
  detectors: [{ matchPackage: 'bridgetown' }],
  priority: 70,
  getDefaultConfig: () => ({
    runtime: DEFAULT_RUBY_RUNTIME,
    memory: 128,
    maxDuration: 30,
    streaming: false,
    commands: ['bin/bridgetown deploy'],
    assetsDir: 'output',
    populateAssetCache: true,
    routes: [],
    environmentVariables: { BRIDGETOWN_ENV: 'production' },
  }),
};

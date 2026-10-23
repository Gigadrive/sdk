import type { FrameworkDefinition } from '../types';
import { refineRubyPublicDirectory, rubyServerDefaults } from './ruby-server';

export const roda: FrameworkDefinition = {
  slug: 'roda',
  name: 'Roda',
  language: 'ruby',
  detectors: [{ matchPackage: 'roda' }, { path: 'config.ru' }],
  priority: 60,
  getDefaultConfig: () => rubyServerDefaults({ environmentVariables: { RACK_ENV: 'production' } }),
  refineDefaultConfig: refineRubyPublicDirectory,
};

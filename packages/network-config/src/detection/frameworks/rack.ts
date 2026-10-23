import type { FrameworkDefinition } from '../types';
import { refineRubyPublicDirectory, rubyServerDefaults } from './ruby-server';

/**
 * Any Rack application no specific Ruby preset claimed: a `config.ru` next to
 * a `Gemfile`, as Grape, Padrino and plain Rack applications have. Ranked
 * below every other Ruby preset.
 */
export const rack: FrameworkDefinition = {
  slug: 'rack',
  name: 'Rack',
  language: 'ruby',
  detectors: [{ path: 'config.ru' }, { path: 'Gemfile' }],
  priority: 10,
  getDefaultConfig: () => rubyServerDefaults({ environmentVariables: { RACK_ENV: 'production' } }),
  refineDefaultConfig: refineRubyPublicDirectory,
};

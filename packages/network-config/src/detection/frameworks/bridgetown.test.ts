import { describe, expect, it } from 'vitest';
import { detectProject, gemfileLock } from './test-utils';

describe('Bridgetown framework detection', () => {
  it('should build a Bridgetown site into static assets without a function', async () => {
    const result = await detectProject({
      '/project/Gemfile': "gem 'bridgetown', '~> 2.0'\ngem 'puma'",
      // Bridgetown ships a Roda server and a config.ru for its dev server.
      '/project/Gemfile.lock': gemfileLock(['bridgetown', 'bridgetown-core', 'puma', 'rack', 'roda']),
      '/project/config.ru': "require 'bridgetown-core/rack/boot'\nrun RodaApp.freeze.app",
      '/project/output/index.html': '<html></html>',
    });

    expect(result.framework).toMatchObject({ slug: 'bridgetown', name: 'Bridgetown' });
    expect(result.packageManager).toBe('bundler');
    expect(result.config.commands).toEqual(['bundle install', 'bin/bridgetown deploy']);
    expect(result.config.entrypoints).toEqual([]);
    expect(result.config.routes).toEqual([]);
    expect(result.config.environmentVariables).toEqual({ BRIDGETOWN_ENV: 'production' });
    expect(result.config.assets).toMatchObject({
      paths: ['output/index.html'],
      prefixToStrip: 'output/',
      populateCache: true,
    });
  });
});

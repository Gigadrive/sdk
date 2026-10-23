import { describe, expect, it } from 'vitest';
import { detectProject, detectProjectError, gemfileLock } from './test-utils';

describe('Roda framework detection', () => {
  it('should detect Roda and generate a rackup entrypoint config', async () => {
    const result = await detectProject({
      '/project/Gemfile': "gem 'roda'",
      '/project/Gemfile.lock': gemfileLock(['puma', 'rack', 'roda']),
      '/project/config.ru': "require_relative 'app'\nrun App.freeze.app",
      '/project/public/app.js': 'app()',
    });

    expect(result.framework).toMatchObject({ slug: 'roda', name: 'Roda' });
    expect(result.packageManager).toBe('bundler');
    expect(result.config.commands).toEqual(['bundle install']);
    expect(result.config.entrypoints).toEqual([
      expect.objectContaining({ path: 'config.ru', runtime: 'ruby-34', memory: 256, streaming: true }),
    ]);
    expect(result.config.routes).toEqual([expect.objectContaining({ path: '/*', destination: 'config.ru' })]);
    expect(result.config.environmentVariables).toEqual({ RACK_ENV: 'production' });
    expect(result.config.assets).toMatchObject({ paths: ['public/app.js'], prefixToStrip: 'public/' });
  });

  it('should not detect Roda without config.ru', async () => {
    const result = await detectProjectError({ '/project/Gemfile.lock': gemfileLock(['roda']) });

    expect(result).toHaveProperty('error');
  });
});

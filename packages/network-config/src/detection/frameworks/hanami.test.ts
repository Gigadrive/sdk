import { describe, expect, it } from 'vitest';
import { detectProject, detectProjectError, gemfileLock } from './test-utils';

const hanamiApp = (gems: string[], files: Record<string, string> = {}) => ({
  '/project/Gemfile.lock': gemfileLock(['hanami', 'hanami-router', 'puma', ...gems]),
  '/project/config.ru': "require 'hanami/boot'\nrun Hanami.app",
  ...files,
});

describe('Hanami framework detection', () => {
  it('should detect Hanami and generate a rackup entrypoint config', async () => {
    const result = await detectProject(hanamiApp([], { '/project/public/favicon.ico': 'icon' }));

    expect(result.framework).toMatchObject({ slug: 'hanami', name: 'Hanami' });
    expect(result.packageManager).toBe('bundler');
    expect(result.config.commands).toEqual(['bundle install']);
    expect(result.config.entrypoints).toEqual([
      expect.objectContaining({
        path: 'config.ru',
        runtime: 'ruby-34',
        memory: 256,
        maxDuration: 30,
        streaming: true,
        package: { writablePaths: ['tmp', 'log'] },
      }),
    ]);
    expect(result.config.routes).toEqual([expect.objectContaining({ path: '/*', destination: 'config.ru' })]);
    expect(result.config.excludeFiles).toEqual(['tmp/', 'log/', 'spec/', 'node_modules/', '.git/']);
    expect(result.config.environmentVariables).toEqual({ HANAMI_ENV: 'production', RACK_ENV: 'production' });
    expect(result.config.assets).toMatchObject({ paths: ['public/favicon.ico'], prefixToStrip: 'public/' });
  });

  it('should compile assets when Gemfile.lock lists hanami-assets', async () => {
    const result = await detectProject(hanamiApp(['hanami-assets']));

    expect(result.config.commands).toEqual(['bundle install', 'bundle exec hanami assets compile']);
  });

  it('should publish no assets without a public directory', async () => {
    const result = await detectProject(hanamiApp([]));

    expect(result.config.assets).toBeUndefined();
  });

  it('should prefer Hanami over the generic Rack preset', async () => {
    const result = await detectProject(hanamiApp([], { '/project/Gemfile': "gem 'hanami'" }));

    expect(result.framework.slug).toBe('hanami');
  });

  it('should not detect Hanami without config.ru', async () => {
    const result = await detectProjectError({ '/project/Gemfile.lock': gemfileLock(['hanami']) });

    expect(result).toHaveProperty('error');
  });
});

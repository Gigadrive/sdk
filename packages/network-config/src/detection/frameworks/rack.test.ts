import { describe, expect, it } from 'vitest';
import { detectProject, detectProjectError, gemfileLock, packageJson } from './test-utils';

describe('Rack framework detection', () => {
  it.each([
    { name: 'Grape', gems: ['grape', 'rack'] },
    { name: 'plain Rack', gems: ['rack', 'puma'] },
  ])('should detect a $name application as Rack', async ({ gems }) => {
    const result = await detectProject({
      '/project/Gemfile': "gem 'rack'",
      '/project/Gemfile.lock': gemfileLock(gems),
      '/project/config.ru': 'run ->(env) { [200, {}, ["ok"]] }',
    });

    expect(result.framework).toMatchObject({ slug: 'rack', name: 'Rack' });
    expect(result.packageManager).toBe('bundler');
    expect(result.config.commands).toEqual(['bundle install']);
    expect(result.config.entrypoints).toEqual([
      expect.objectContaining({ path: 'config.ru', runtime: 'ruby-34', memory: 256, maxDuration: 30, streaming: true }),
    ]);
    expect(result.config.routes).toEqual([expect.objectContaining({ path: '/*', destination: 'config.ru' })]);
    expect(result.config.environmentVariables).toEqual({ RACK_ENV: 'production' });
    expect(result.config.assets).toBeUndefined();
  });

  it('should detect Rack from a Gemfile without a lockfile', async () => {
    const result = await detectProject({ '/project/Gemfile': "gem 'rack'", '/project/config.ru': 'run App' });

    expect(result.framework.slug).toBe('rack');
    expect(result.config.commands).toEqual(['bundle install']);
  });

  it('should run bundle install even when the project also has Node lockfiles', async () => {
    const result = await detectProject({
      '/project/Gemfile': "gem 'rack'",
      '/project/config.ru': 'run App',
      '/project/package.json': packageJson({ esbuild: '^0.24.0' }),
      '/project/pnpm-lock.yaml': '',
    });

    expect(result.packageManager).toBe('bundler');
    expect(result.config.commands[0]).toBe('bundle install');
  });

  it('should not detect Rack from config.ru without a Gemfile', async () => {
    const result = await detectProjectError({ '/project/config.ru': 'run App' });

    expect(result).toHaveProperty('error');
  });

  it('should not detect Rack from a Gemfile without config.ru', async () => {
    const result = await detectProjectError({ '/project/Gemfile': "gem 'fastlane'" });

    expect(result).toHaveProperty('error');
  });

  it('should not make a Node project with a Gemfile install with Bundler', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson({ express: '^5.0.0' }),
      '/project/Gemfile': "gem 'fastlane'",
      '/project/Gemfile.lock': gemfileLock(['fastlane']),
    });

    expect(result.framework.slug).toBe('express');
    expect(result.packageManager).toBe('npm');
    expect(result.config.commands[0]).toBe('npm install');
  });
});

import { describe, expect, it } from 'vitest';
import { detectProject, detectProjectError, gemfileLock, packageJson } from './test-utils';

const railsApp = (gems: string[], files: Record<string, string> = {}) => ({
  '/project/Gemfile': "source 'https://rubygems.org'\ngem 'rails', '~> 8.0'\n",
  '/project/Gemfile.lock': gemfileLock(['actionpack', 'rack', 'rails', 'railties', ...gems]),
  '/project/config/application.rb': 'module App; class Application < Rails::Application; end; end',
  '/project/config.ru': 'run Rails.application',
  ...files,
});

describe('Rails framework detection', () => {
  it('should detect Rails and generate a rackup entrypoint config', async () => {
    const result = await detectProject(railsApp(['propshaft', 'puma'], { '/project/public/robots.txt': '' }));

    expect(result.framework).toMatchObject({ slug: 'rails', name: 'Ruby on Rails' });
    expect(result.packageManager).toBe('bundler');
    expect(result.config.commands).toEqual([
      'bundle install',
      'SECRET_KEY_BASE_DUMMY=1 bundle exec rails assets:precompile',
    ]);
    expect(result.config.entrypoints).toEqual([
      {
        path: 'config.ru',
        runtime: 'ruby-34',
        memory: 512,
        maxDuration: 30,
        streaming: true,
        symlinks: undefined,
        package: { writablePaths: ['tmp/cache', 'tmp/pids', 'tmp/sockets', 'tmp/storage', 'log', 'storage'] },
      },
    ]);
    expect(result.config.routes).toEqual([
      expect.objectContaining({ path: '/*', destination: 'config.ru', handler: 'SERVERLESS_FUNCTION_STREAMING' }),
    ]);
    expect(result.config.excludeFiles).toEqual([
      'tmp/',
      'log/',
      'storage/',
      'test/',
      'spec/',
      'node_modules/',
      '.git/',
    ]);
    expect(result.config.environmentVariables).toEqual({
      RAILS_ENV: 'production',
      RACK_ENV: 'production',
      SECRET_KEY_BASE: '{{gigadrive.secret:hex}}',
      RAILS_LOG_TO_STDOUT: '1',
      RAILS_SERVE_STATIC_FILES: '1',
      RAILS_MAX_THREADS: '5',
    });
  });

  it.each(['propshaft', 'sprockets'])('should precompile assets when Gemfile.lock lists %s', async (gem) => {
    const result = await detectProject(railsApp([gem]));

    expect(result.config.commands).toContain('SECRET_KEY_BASE_DUMMY=1 bundle exec rails assets:precompile');
  });

  it('should not precompile assets for an API-only application', async () => {
    const result = await detectProject(railsApp(['puma']));

    expect(result.config.commands).toEqual(['bundle install']);
  });

  it('should publish public/ without dotfiles', async () => {
    const result = await detectProject(
      railsApp(['propshaft'], {
        '/project/public/assets/application-0a1b2c.css': 'body{}',
        '/project/public/robots.txt': 'User-agent: *',
        '/project/public/.gitkeep': '',
        '/project/app/models/user.rb': 'class User; end',
      })
    );

    expect(result.config.assets).toEqual({
      paths: ['public/assets/application-0a1b2c.css', 'public/robots.txt'],
      prefixToStrip: 'public/',
      dynamicRoutes: true,
      populateCache: true,
    });
  });

  it('should publish no assets without a public directory', async () => {
    const result = await detectProject(railsApp([]));

    expect(result.config.assets).toBeUndefined();
  });

  // Container detection runs only when no framework matched, so the Dockerfile
  // and Compose file every Rails 7.1+ application ships never replace Rails.
  it('should detect Rails over a Dockerfile, as Rails 7.1+ applications ship one', async () => {
    const result = await detectProject(
      railsApp(['propshaft'], {
        '/project/Dockerfile': 'FROM ruby:3.4\nCMD ["./bin/thrust", "./bin/rails", "server"]',
        '/project/.dockerignore': '/.git',
        '/project/compose.yaml': 'services:\n  web:\n    build: .\n',
      })
    );

    expect(result.framework.slug).toBe('rails');
    expect(result.config.entrypoints).toEqual([expect.objectContaining({ path: 'config.ru', runtime: 'ruby-34' })]);
  });

  it.each(['sinatra', 'roda', 'hanami', 'jekyll'])(
    'should prefer Rails over %s in the same Gemfile.lock',
    async (gem) => {
      const result = await detectProject(railsApp([gem]));

      expect(result.framework.slug).toBe('rails');
    }
  );

  it('should prefer Rails over a Vite front end in package.json', async () => {
    const result = await detectProject(
      railsApp(['vite_rails'], {
        '/project/package.json': packageJson({ vite: '^6.0.0' }),
        '/project/package-lock.json': '',
      })
    );

    expect(result.framework.slug).toBe('rails');
    expect(result.packageManager).toBe('bundler');
    expect(result.config.commands[0]).toBe('bundle install');
  });

  it('should detect Rails from a Gemfile without a lockfile', async () => {
    const result = await detectProject({
      '/project/Gemfile': "source 'https://rubygems.org'\ngem 'rails', '~> 8.0'\ngem 'propshaft'\n",
      '/project/config/application.rb': '',
      '/project/config.ru': 'run Rails.application',
    });

    expect(result.framework.slug).toBe('rails');
    expect(result.config.commands).toEqual([
      'bundle install',
      'SECRET_KEY_BASE_DUMMY=1 bundle exec rails assets:precompile',
    ]);
  });

  it('should not detect Rails without config/application.rb', async () => {
    const result = await detectProjectError({ '/project/Gemfile.lock': gemfileLock(['railties']) });

    expect(result).toHaveProperty('error');
  });

  it('should not detect Rails from config/application.rb without railties', async () => {
    const result = await detectProjectError({
      '/project/Gemfile.lock': gemfileLock(['puma']),
      '/project/config/application.rb': '',
    });

    expect(result).toHaveProperty('error');
  });
});

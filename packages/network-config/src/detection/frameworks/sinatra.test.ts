import { describe, expect, it } from 'vitest';
import { detectProject, gemfileLock } from './test-utils';

const sinatraApp = (files: Record<string, string>) => ({
  '/project/Gemfile.lock': gemfileLock(['mustermann', 'puma', 'rack', 'sinatra']),
  ...files,
});

describe('Sinatra framework detection', () => {
  it('should detect a modular Sinatra app through config.ru', async () => {
    const result = await detectProject(
      sinatraApp({
        '/project/config.ru': "require './app'\nrun App",
        '/project/app.rb': 'class App < Sinatra::Base; end',
      })
    );

    expect(result.framework).toMatchObject({ slug: 'sinatra', name: 'Sinatra' });
    expect(result.packageManager).toBe('bundler');
    expect(result.config.commands).toEqual(['bundle install']);
    expect(result.config.entrypoints).toEqual([
      expect.objectContaining({ path: 'config.ru', runtime: 'ruby-34', memory: 256, maxDuration: 30, streaming: true }),
    ]);
    expect(result.config.routes).toEqual([
      expect.objectContaining({ path: '/*', destination: 'config.ru', handler: 'SERVERLESS_FUNCTION_STREAMING' }),
    ]);
    expect(result.config.environmentVariables).toEqual({ APP_ENV: 'production', RACK_ENV: 'production' });
  });

  it.each(['app.rb', 'main.rb', 'server.rb', 'application.rb'])(
    'should run a classic Sinatra script from %s without config.ru',
    async (script) => {
      const result = await detectProject(
        sinatraApp({ [`/project/${script}`]: "require 'sinatra'\nget('/') { 'hi' }" })
      );

      expect(result.config.entrypoints).toEqual([expect.objectContaining({ path: script })]);
      expect(result.config.routes).toEqual([expect.objectContaining({ path: '/*', destination: script })]);
    }
  );

  it('should prefer config.ru over a script, and scripts in order', async () => {
    const withRackup = await detectProject(
      sinatraApp({ '/project/config.ru': 'run App', '/project/app.rb': '', '/project/main.rb': '' })
    );
    const withScripts = await detectProject(sinatraApp({ '/project/server.rb': '', '/project/main.rb': '' }));

    expect(withRackup.config.entrypoints).toEqual([expect.objectContaining({ path: 'config.ru' })]);
    expect(withScripts.config.entrypoints).toEqual([expect.objectContaining({ path: 'main.rb' })]);
  });

  it('should publish public/ and never its Ruby sources', async () => {
    const result = await detectProject(
      sinatraApp({
        '/project/app.rb': '',
        '/project/public/css/style.css': 'body{}',
        '/project/public/helpers.rb': 'module Helpers; end',
        '/project/public/.env': 'SECRET=1',
      })
    );

    expect(result.config.assets).toMatchObject({ paths: ['public/css/style.css'], populateCache: true });
  });

  it('should detect Sinatra from a Gemfile without a lockfile', async () => {
    const result = await detectProject({
      '/project/Gemfile': "source 'https://rubygems.org'\ngem 'sinatra'\ngem 'puma'\n",
      '/project/app.rb': "require 'sinatra'",
    });

    expect(result.framework.slug).toBe('sinatra');
    expect(result.packageManager).toBe('bundler');
    expect(result.config.entrypoints).toEqual([expect.objectContaining({ path: 'app.rb' })]);
  });
});

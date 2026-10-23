import { describe, expect, it } from 'vitest';
import { detectProject, gemfileLock } from './test-utils';

describe('Jekyll framework detection', () => {
  it('should build a Jekyll site into static assets without a function', async () => {
    const result = await detectProject({
      '/project/Gemfile': "source 'https://rubygems.org'\ngem 'jekyll', '~> 4.3'\n",
      '/project/Gemfile.lock': gemfileLock(['jekyll', 'kramdown', 'liquid']),
      '/project/_config.yml': 'title: Blog',
      '/project/_site/index.html': '<html></html>',
      '/project/_site/about/index.html': '<html></html>',
      '/project/_site/assets/main.css': 'body{}',
    });

    expect(result.framework).toMatchObject({ slug: 'jekyll', name: 'Jekyll' });
    expect(result.packageManager).toBe('bundler');
    expect(result.config.commands).toEqual(['bundle install', 'bundle exec jekyll build']);
    expect(result.config.entrypoints).toEqual([]);
    expect(result.config.routes).toEqual([]);
    expect(result.config.environmentVariables).toEqual({ JEKYLL_ENV: 'production' });
    expect(result.config.assets).toEqual({
      paths: ['_site/about/index.html', '_site/assets/main.css', '_site/index.html'],
      prefixToStrip: '_site/',
      overrides: { 'about/index.html': { path: 'about' }, 'index.html': { path: '' } },
      dynamicRoutes: true,
      populateCache: true,
    });
  });

  it('should stay Jekyll with a stray config.ru', async () => {
    const result = await detectProject({
      '/project/Gemfile': "gem 'jekyll'\ngem 'rack-jekyll'",
      '/project/Gemfile.lock': gemfileLock(['jekyll', 'rack', 'rack-jekyll']),
      '/project/config.ru': "require 'rack/jekyll'\nrun Rack::Jekyll.new",
    });

    expect(result.framework.slug).toBe('jekyll');
    expect(result.config.entrypoints).toEqual([]);
  });

  it('should detect a GitHub Pages site whose Gemfile declares only github-pages', async () => {
    const result = await detectProject({ '/project/Gemfile': "gem 'github-pages', group: :jekyll_plugins" });

    expect(result.framework.slug).toBe('jekyll');
    expect(result.config.commands).toEqual(['bundle install', 'bundle exec jekyll build']);
  });
});

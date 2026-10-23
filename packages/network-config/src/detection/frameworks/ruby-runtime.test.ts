import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import { makeTestFs, TestPathLayer } from '../../test-utils';
import { detectRubyRuntime, rubyRuntimeForRequirement, rubyRuntimeForVersion } from './ruby-runtime';
import { detectProject } from './test-utils';

const runDetectRubyRuntime = (files: Record<string, string>) =>
  Effect.runPromise(detectRubyRuntime('/project').pipe(Effect.provide(Layer.merge(makeTestFs(files), TestPathLayer))));

const SINATRA_LOCKFILE = 'GEM\n  remote: https://rubygems.org/\n  specs:\n    sinatra (4.0.0)\n';

const gemfileLockWithRuby = (version: string) => `${SINATRA_LOCKFILE}\nRUBY VERSION\n   ruby ${version}\n`;

describe('rubyRuntimeForVersion', () => {
  it.each([
    { version: '3.3.6', runtime: 'ruby-33' },
    { version: '3.3', runtime: 'ruby-33' },
    { version: 'ruby-3.3.6', runtime: 'ruby-33' },
    { version: '3.4.1', runtime: 'ruby-34' },
    { version: 'ruby-3.4.1', runtime: 'ruby-34' },
    { version: '3.4.0-preview1', runtime: 'ruby-34' },
    { version: '4.0.0', runtime: 'ruby-40' },
    { version: '4.0', runtime: 'ruby-40' },
    { version: '3.3.6p108', runtime: 'ruby-33' },
    // Older than every runtime: the oldest one.
    { version: '3.2.2', runtime: 'ruby-33' },
    { version: '3.1', runtime: 'ruby-33' },
    { version: '2.7.8', runtime: 'ruby-33' },
    // Newer than every runtime: the newest one.
    { version: '4.1.0', runtime: 'ruby-40' },
    { version: '5.0', runtime: 'ruby-40' },
    // Between two runtimes: the newest runtime older than the version.
    { version: '3.5.0', runtime: 'ruby-34' },
  ])('should pick $runtime for $version', ({ version, runtime }) => {
    expect(rubyRuntimeForVersion(version)).toBe(runtime);
  });

  it.each(['', 'jruby-9.4.5.0', 'system', '~> 3.3'])('should pick no runtime for %j', (version) => {
    expect(rubyRuntimeForVersion(version)).toBeUndefined();
  });
});

describe('rubyRuntimeForRequirement', () => {
  it.each([
    // An exact version is a concrete version.
    { requirement: '3.3.6', runtime: 'ruby-33' },
    { requirement: '= 3.4.1', runtime: 'ruby-34' },
    { requirement: '3.2.2', runtime: 'ruby-33' },
    { requirement: '4.1.0', runtime: 'ruby-40' },
    // Anything else picks the newest runtime it allows.
    { requirement: '~> 3.3', runtime: 'ruby-34' },
    { requirement: '~> 3.3.1', runtime: 'ruby-33' },
    { requirement: '~> 3.3.0', runtime: 'ruby-33' },
    { requirement: '~> 3.4', runtime: 'ruby-34' },
    { requirement: '~> 4.0', runtime: 'ruby-40' },
    { requirement: '~> 3', runtime: 'ruby-34' },
    { requirement: '>= 3.2', runtime: 'ruby-40' },
    { requirement: '> 3.3', runtime: 'ruby-40' },
    { requirement: '< 4', runtime: 'ruby-34' },
    { requirement: '>= 3.2, < 3.4', runtime: 'ruby-33' },
    // RubyGems reads `<= 3.4` as `<= 3.4.0`, which no current 3.4 release satisfies.
    { requirement: '<= 3.4', runtime: 'ruby-33' },
    { requirement: '!= 3.3.5', runtime: 'ruby-40' },
  ])('should pick $runtime for $requirement', ({ requirement, runtime }) => {
    expect(rubyRuntimeForRequirement(requirement)).toBe(runtime);
  });

  it.each(['~> 3.2.0', '< 3.3', '~> 2.7', '>= 5.0', 'latest', ''])('should pick no runtime for %j', (requirement) => {
    expect(rubyRuntimeForRequirement(requirement)).toBeUndefined();
  });
});

describe('detectRubyRuntime', () => {
  it.each([
    { name: 'a plain version', content: '3.3.6\n', runtime: 'ruby-33' },
    { name: 'a ruby- prefix', content: 'ruby-3.3.6', runtime: 'ruby-33' },
    { name: 'a minor version', content: '3.3', runtime: 'ruby-33' },
    { name: 'a 3.4 version with a prefix', content: 'ruby-3.4.1', runtime: 'ruby-34' },
    { name: 'trailing whitespace', content: '4.0.0  \r\n', runtime: 'ruby-40' },
    { name: 'text after a space', content: '3.3.6 # pinned for production', runtime: 'ruby-33' },
    { name: 'an rvm gemset', content: 'ruby-3.3.6@myapp', runtime: 'ruby-33' },
    { name: 'a leading comment', content: '# rbenv\n3.3.6\n', runtime: 'ruby-33' },
  ])('should read .ruby-version with $name', async ({ content, runtime }) => {
    expect(await runDetectRubyRuntime({ '/project/.ruby-version': content })).toBe(runtime);
  });

  it('should read the ruby line of .tool-versions', async () => {
    const runtime = await runDetectRubyRuntime({
      '/project/.tool-versions': 'nodejs 22.11.0\nruby 3.3.6\npython 3.12.0\n',
    });

    expect(runtime).toBe('ruby-33');
  });

  it.each([
    { name: 'an exact version', directive: 'ruby "3.3.6"', runtime: 'ruby-33' },
    { name: 'a pessimistic requirement', directive: "ruby '~> 3.3'", runtime: 'ruby-34' },
    { name: 'a lower bound', directive: 'ruby ">= 3.2"', runtime: 'ruby-40' },
    { name: 'several requirements', directive: "ruby '>= 3.2', '< 3.4'", runtime: 'ruby-33' },
    { name: 'a comma-separated requirement', directive: "ruby '>= 3.2, < 3.4'", runtime: 'ruby-33' },
    { name: 'parentheses', directive: 'ruby("~> 3.4.0")', runtime: 'ruby-34' },
    {
      name: 'an engine keyword',
      directive: 'ruby "3.3.6", engine: "ruby", engine_version: "3.3.6"',
      runtime: 'ruby-33',
    },
  ])('should read the Gemfile ruby directive with $name', async ({ directive, runtime }) => {
    const result = await runDetectRubyRuntime({
      '/project/Gemfile': `source "https://rubygems.org"\n\n${directive}\n\ngem "sinatra"\n`,
    });

    expect(result).toBe(runtime);
  });

  it.each([
    { name: 'file:', directive: 'ruby file: ".ruby-version"' },
    { name: 'a hash rocket', directive: "ruby :file => '.ruby-version'" },
    { name: 'File.read', directive: 'ruby File.read(".ruby-version").strip' },
  ])('should read the version file the Gemfile ruby directive names with $name', async ({ directive }) => {
    // Only the Gemfile reaches this file; .ruby-version is otherwise read first anyway.
    const result = await runDetectRubyRuntime({
      '/project/Gemfile': `${directive.replace('.ruby-version', 'config/ruby-version')}\ngem "sinatra"\n`,
      '/project/config/ruby-version': 'ruby-3.3.6\n',
    });

    expect(result).toBe('ruby-33');
  });

  it('should read a .tool-versions file the Gemfile ruby directive names', async () => {
    const result = await runDetectRubyRuntime({
      '/project/Gemfile': 'ruby file: "config/.tool-versions"\ngem "sinatra"\n',
      '/project/config/.tool-versions': 'ruby 3.4.1\n',
    });

    expect(result).toBe('ruby-34');
  });

  it('should read the RUBY VERSION section of Gemfile.lock', async () => {
    expect(await runDetectRubyRuntime({ '/project/Gemfile.lock': gemfileLockWithRuby('3.3.6p108') })).toBe('ruby-33');
  });

  it('should prefer .ruby-version over .tool-versions, the Gemfile and Gemfile.lock', async () => {
    const result = await runDetectRubyRuntime({
      '/project/.ruby-version': '3.3.6',
      '/project/.tool-versions': 'ruby 3.4.1',
      '/project/Gemfile': 'ruby "4.0.0"',
      '/project/Gemfile.lock': gemfileLockWithRuby('4.0.0'),
    });

    expect(result).toBe('ruby-33');
  });

  it('should prefer .tool-versions over the Gemfile and Gemfile.lock', async () => {
    const result = await runDetectRubyRuntime({
      '/project/.tool-versions': 'ruby 3.3.6',
      '/project/Gemfile': 'ruby "4.0.0"',
      '/project/Gemfile.lock': gemfileLockWithRuby('4.0.0'),
    });

    expect(result).toBe('ruby-33');
  });

  it('should prefer the Gemfile ruby directive over Gemfile.lock', async () => {
    const result = await runDetectRubyRuntime({
      '/project/Gemfile': "ruby '~> 3.3.0'",
      '/project/Gemfile.lock': gemfileLockWithRuby('4.0.0'),
    });

    expect(result).toBe('ruby-33');
  });

  it('should fall through sources that name no usable version', async () => {
    const result = await runDetectRubyRuntime({
      '/project/.ruby-version': 'jruby-9.4.5.0',
      '/project/.tool-versions': 'nodejs 22.11.0',
      '/project/Gemfile': "ruby RUBY_VERSION\ngem 'sinatra'",
      '/project/Gemfile.lock': gemfileLockWithRuby('3.4.1p0'),
    });

    expect(result).toBe('ruby-34');
  });

  it('should fall through a Gemfile requirement no runtime satisfies', async () => {
    const result = await runDetectRubyRuntime({
      '/project/Gemfile': "ruby '~> 3.2.0'",
      '/project/Gemfile.lock': gemfileLockWithRuby('3.2.2'),
    });

    expect(result).toBe('ruby-33');
  });

  it('should ignore a Gemfile ruby directive whose version file is missing', async () => {
    expect(await runDetectRubyRuntime({ '/project/Gemfile': 'ruby file: ".ruby-version"' })).toBeUndefined();
  });

  it('should return undefined without any version source', async () => {
    expect(await runDetectRubyRuntime({ '/project/Gemfile': "gem 'sinatra'" })).toBeUndefined();
  });

  it('should not mistake a gem named like ruby for the ruby directive', async () => {
    expect(await runDetectRubyRuntime({ '/project/Gemfile': "gem 'ruby-openai', '7.0.0'" })).toBeUndefined();
  });
});

describe('Ruby runtime of detected presets', () => {
  it('should default to ruby-34 without a Ruby version', async () => {
    const result = await detectProject({
      '/project/Gemfile.lock': SINATRA_LOCKFILE,
      '/project/config.ru': 'run Sinatra::Application',
    });

    expect(result.framework.slug).toBe('sinatra');
    expect(result.config.entrypoints).toEqual([expect.objectContaining({ runtime: 'ruby-34' })]);
  });

  it.each([
    { name: '.ruby-version', files: { '/project/.ruby-version': '3.3.6' }, runtime: 'ruby-33' },
    { name: '.tool-versions', files: { '/project/.tool-versions': 'ruby 4.0.0' }, runtime: 'ruby-40' },
    { name: 'a Gemfile requirement', files: { '/project/Gemfile': "ruby '>= 3.2'" }, runtime: 'ruby-40' },
    { name: 'an old version', files: { '/project/.ruby-version': '3.2.2' }, runtime: 'ruby-33' },
  ])('should run a Sinatra app on $runtime from $name', async ({ files, runtime }) => {
    const result = await detectProject({
      '/project/Gemfile.lock': SINATRA_LOCKFILE,
      '/project/config.ru': 'run Sinatra::Application',
      ...files,
    });

    expect(result.config.entrypoints).toEqual([expect.objectContaining({ path: 'config.ru', runtime })]);
  });

  it('should keep the entrypoint a preset refined while setting the runtime', async () => {
    const result = await detectProject({
      '/project/Gemfile.lock': SINATRA_LOCKFILE,
      '/project/app.rb': "require 'sinatra'",
      '/project/.ruby-version': '3.3.6',
    });

    expect(result.config.entrypoints).toEqual([expect.objectContaining({ path: 'app.rb', runtime: 'ruby-33' })]);
  });
});

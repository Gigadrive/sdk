import { FileSystem } from '@effect/platform';
import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import { makeTestFs, TestPathLayer } from '../test-utils';
import { readDependencies } from './read-dependencies';

describe('readDependencies', () => {
  it('should read node dependencies from package.json', async () => {
    const fs = makeTestFs({
      '/project/package.json': JSON.stringify({
        dependencies: { next: '^14.0.0', react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      }),
    });

    const result = await Effect.runPromise(
      readDependencies('/project', 'node').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    expect(result).toEqual(new Set(['next', 'react', 'typescript']));
  });

  it('should read php dependencies from composer.json', async () => {
    const fs = makeTestFs({
      '/project/composer.json': JSON.stringify({
        require: { php: '^8.1', 'laravel/framework': '^11.0' },
        'require-dev': { 'phpunit/phpunit': '^10.0' },
      }),
    });

    const result = await Effect.runPromise(
      readDependencies('/project', 'php').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    expect(result).toEqual(new Set(['php', 'laravel/framework', 'phpunit/phpunit']));
  });

  it('should read every resolved gem from Gemfile.lock, including transitive ones', async () => {
    const fs = makeTestFs({
      '/project/Gemfile': "gem 'rails'",
      '/project/Gemfile.lock': [
        'GIT',
        '  remote: https://github.com/example/forked_gem.git',
        '  revision: 0123456789abcdef',
        '  specs:',
        '    forked_gem (1.2.0)',
        '',
        'PATH',
        '  remote: engines/billing',
        '  specs:',
        '    billing (0.1.0)',
        '      rails (>= 7.1)',
        '',
        'GEM',
        '  remote: https://rubygems.org/',
        '  specs:',
        '    actionpack (7.1.3)',
        '      rack (>= 2.2.4)',
        '    nokogiri (1.16.2-x86_64-linux)',
        '    rails (7.1.3)',
        '      railties (= 7.1.3)',
        '    railties (7.1.3)',
        '    sprockets-rails (3.4.2)',
        '',
        'PLATFORMS',
        '  x86_64-linux',
        '',
        'DEPENDENCIES',
        '  only_in_dependencies (~> 1.0)',
        '  rails (~> 7.1.3)',
        '',
        'CHECKSUMS',
        '    not_a_spec (1.0.0) sha256=abc',
        '',
        'RUBY VERSION',
        '   ruby 3.3.6p108',
        '',
        'BUNDLED WITH',
        '   2.5.6',
      ].join('\n'),
    });

    const result = await Effect.runPromise(
      readDependencies('/project', 'ruby').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    expect(result).toEqual(
      new Set(['forked_gem', 'billing', 'actionpack', 'nokogiri', 'rails', 'railties', 'sprockets-rails'])
    );
  });

  it('should read Gemfile.lock with Windows line endings', async () => {
    const fs = makeTestFs({
      '/project/Gemfile.lock': 'GEM\r\n  remote: https://rubygems.org/\r\n  specs:\r\n    sinatra (4.0.0)\r\n',
    });

    const result = await Effect.runPromise(
      readDependencies('/project', 'ruby').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    expect(result).toEqual(new Set(['sinatra']));
  });

  it('should read declared gems from a Gemfile without a lockfile', async () => {
    const fs = makeTestFs({
      '/project/Gemfile': [
        "source 'https://rubygems.org'",
        'ruby "3.3.6"',
        "gem 'rails', '~> 7.1'",
        'gem "puma", ">= 5.0"',
        "  gem('pg')",
        '# gem "commented_out"',
        'group :development do',
        "  gem 'debug', platforms: %i[mri]",
        'end',
      ].join('\n'),
    });

    const result = await Effect.runPromise(
      readDependencies('/project', 'ruby').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    expect(result).toEqual(new Set(['rails', 'puma', 'pg', 'debug']));
  });

  it('should return an empty set for a Ruby project without a Gemfile', async () => {
    const fs = makeTestFs({ '/project/config.ru': 'run App' });

    const result = await Effect.runPromise(
      readDependencies('/project', 'ruby').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    expect(result).toEqual(new Set());
  });

  it('should propagate ManifestReadError when Gemfile.lock exists but cannot be read', async () => {
    const errorFs = Layer.merge(
      Layer.succeed(FileSystem.FileSystem, {
        exists: (p: string) => Effect.succeed(p === '/project/Gemfile.lock'),
        readFileString: () => Effect.fail(new Error('Permission denied')),
      } as unknown as FileSystem.FileSystem),
      TestPathLayer
    );

    const result = await Effect.runPromise(
      readDependencies('/project', 'ruby').pipe(
        Effect.catchTag('ManifestReadError', (e) => Effect.succeed({ _tag: e._tag, filePath: e.filePath })),
        Effect.provide(errorFs)
      )
    );

    expect(result).toMatchObject({ _tag: 'ManifestReadError', filePath: '/project/Gemfile.lock' });
  });

  it('should return empty set when manifest does not exist', async () => {
    const fs = makeTestFs({});

    const result = await Effect.runPromise(
      readDependencies('/project', 'node').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    expect(result).toEqual(new Set());
  });

  it('should return empty set when manifest has no dependency sections', async () => {
    const fs = makeTestFs({
      '/project/package.json': JSON.stringify({ name: 'my-project', version: '1.0.0' }),
    });

    const result = await Effect.runPromise(
      readDependencies('/project', 'node').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    expect(result).toEqual(new Set());
  });

  it('should fail with ManifestParseError when manifest is invalid JSON', async () => {
    const fs = makeTestFs({
      '/project/package.json': 'not valid json{{{',
    });

    const result = await Effect.runPromiseExit(
      readDependencies('/project', 'node').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );
    expect(result._tag).toBe('Failure');
  });

  it('should merge dependencies and devDependencies for node', async () => {
    const fs = makeTestFs({
      '/project/package.json': JSON.stringify({
        dependencies: { express: '^4.0.0' },
        devDependencies: { express: '^4.0.0', vitest: '^1.0.0' },
      }),
    });

    const result = await Effect.runPromise(
      readDependencies('/project', 'node').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    expect(result).toEqual(new Set(['express', 'vitest']));
  });

  it('should propagate ManifestReadError when file exists but cannot be read', async () => {
    const errorFs = Layer.merge(
      Layer.succeed(FileSystem.FileSystem, {
        exists: (p: string) => Effect.succeed(p === '/project/package.json'),
        readFileString: () => Effect.fail(new Error('Permission denied')),
      } as unknown as FileSystem.FileSystem),
      TestPathLayer
    );

    const result = await Effect.runPromiseExit(readDependencies('/project', 'node').pipe(Effect.provide(errorFs)));

    expect(result._tag).toBe('Failure');
    if (result._tag === 'Failure') {
      const cause = result.cause;
      expect(JSON.stringify(cause)).toContain('ManifestReadError');
    }
  });

  it('should propagate ManifestParseError with correct _tag', async () => {
    const fs = makeTestFs({
      '/project/package.json': 'not valid json{{{',
    });

    const result = await Effect.runPromise(
      readDependencies('/project', 'node').pipe(
        Effect.catchTag('ManifestParseError', (e) => Effect.succeed({ _tag: e._tag, filePath: e.filePath })),
        Effect.provide(Layer.merge(fs, TestPathLayer))
      )
    );

    expect(result).toMatchObject({ _tag: 'ManifestParseError', filePath: '/project/package.json' });
  });
});

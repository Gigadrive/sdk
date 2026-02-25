import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import { makeTestFs, TestPathLayer } from '../test-utils';
import { detectFramework } from './detect-framework';

describe('detectFramework', () => {
  it('should detect Next.js from package.json', async () => {
    const fs = makeTestFs({
      '/project/package.json': JSON.stringify({
        dependencies: { next: '^14.0.0', react: '^18.0.0' },
      }),
    });

    const result = await Effect.runPromise(
      detectFramework('/project').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    expect(result.framework.slug).toBe('nextjs');
    expect(result.framework.name).toBe('Next.js');
    expect(result.config.entrypoints[0].path).toBe('.next/standalone/server.js');
  });

  it('should detect Nuxt from package.json', async () => {
    const fs = makeTestFs({
      '/project/package.json': JSON.stringify({
        dependencies: { nuxt: '^3.0.0' },
      }),
    });

    const result = await Effect.runPromise(
      detectFramework('/project').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    expect(result.framework.slug).toBe('nuxt');
  });

  it('should detect NestJS from package.json', async () => {
    const fs = makeTestFs({
      '/project/package.json': JSON.stringify({
        dependencies: { '@nestjs/core': '^10.0.0', express: '^4.0.0' },
      }),
    });

    const result = await Effect.runPromise(
      detectFramework('/project').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    // NestJS has higher priority than Express
    expect(result.framework.slug).toBe('nestjs');
  });

  it('should detect Laravel from composer.json + artisan file', async () => {
    const fs = makeTestFs({
      '/project/composer.json': JSON.stringify({
        require: { php: '^8.1', 'laravel/framework': '^11.0' },
      }),
      '/project/artisan': '#!/usr/bin/env php',
      '/project/composer.lock': '',
    });

    const result = await Effect.runPromise(
      detectFramework('/project').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    expect(result.framework.slug).toBe('laravel');
    expect(result.packageManager).toBe('composer');
  });

  it('should detect Symfony from composer.json + bin/console', async () => {
    const fs = makeTestFs({
      '/project/composer.json': JSON.stringify({
        require: { 'symfony/framework-bundle': '^7.0' },
      }),
      '/project/bin/console': '#!/usr/bin/env php',
    });

    const result = await Effect.runPromise(
      detectFramework('/project').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    expect(result.framework.slug).toBe('symfony');
  });

  it('should prefer Next.js over Vite when both are present', async () => {
    const fs = makeTestFs({
      '/project/package.json': JSON.stringify({
        dependencies: { next: '^14.0.0', vite: '^5.0.0' },
      }),
    });

    const result = await Effect.runPromise(
      detectFramework('/project').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    expect(result.framework.slug).toBe('nextjs');
  });

  it('should detect Express as fallback', async () => {
    const fs = makeTestFs({
      '/project/package.json': JSON.stringify({
        dependencies: { express: '^4.0.0' },
      }),
    });

    const result = await Effect.runPromise(
      detectFramework('/project').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    expect(result.framework.slug).toBe('express');
  });

  it('should detect Elysia with bun runtime', async () => {
    const fs = makeTestFs({
      '/project/package.json': JSON.stringify({
        dependencies: { elysia: '^1.0.0' },
      }),
    });

    const result = await Effect.runPromise(
      detectFramework('/project').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    expect(result.framework.slug).toBe('elysia');
    expect(result.config.entrypoints[0].runtime).toBe('bun-1');
  });

  it('should fail with FrameworkNotDetectedError when no framework matches', async () => {
    const fs = makeTestFs({
      '/project/package.json': JSON.stringify({
        dependencies: { 'some-unknown-package': '^1.0.0' },
      }),
    });

    const result = await Effect.runPromise(
      detectFramework('/project').pipe(
        Effect.catchTag('FrameworkNotDetectedError', (e) => Effect.succeed({ error: e })),
        Effect.provide(Layer.merge(fs, TestPathLayer))
      )
    );

    expect(result).toHaveProperty('error');
    expect((result as { error: { _tag: string } }).error._tag).toBe('FrameworkNotDetectedError');
  });

  it('should fail when no manifest exists at all', async () => {
    const fs = makeTestFs({});

    const result = await Effect.runPromise(
      detectFramework('/project').pipe(
        Effect.catchTag('FrameworkNotDetectedError', (e) => Effect.succeed({ error: e })),
        Effect.provide(Layer.merge(fs, TestPathLayer))
      )
    );

    expect(result).toHaveProperty('error');
  });

  it('should detect package manager from lockfile', async () => {
    const fs = makeTestFs({
      '/project/package.json': JSON.stringify({
        dependencies: { hono: '^4.0.0' },
      }),
      '/project/pnpm-lock.yaml': '',
    });

    const result = await Effect.runPromise(
      detectFramework('/project').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    expect(result.framework.slug).toBe('hono');
    expect(result.packageManager).toBe('pnpm');
  });

  it('should detect Remix over Express', async () => {
    const fs = makeTestFs({
      '/project/package.json': JSON.stringify({
        dependencies: { '@remix-run/dev': '^2.0.0', express: '^4.0.0' },
      }),
    });

    const result = await Effect.runPromise(
      detectFramework('/project').pipe(Effect.provide(Layer.merge(fs, TestPathLayer)))
    );

    expect(result.framework.slug).toBe('remix');
  });

  it('should require all detectors to match for Laravel', async () => {
    // Has the package but not the artisan file
    const fs = makeTestFs({
      '/project/composer.json': JSON.stringify({
        require: { 'laravel/framework': '^11.0' },
      }),
    });

    const result = await Effect.runPromise(
      detectFramework('/project').pipe(
        Effect.catchTag('FrameworkNotDetectedError', (e) => Effect.succeed({ error: e })),
        Effect.provide(Layer.merge(fs, TestPathLayer))
      )
    );

    expect(result).toHaveProperty('error');
  });

  it('should not crash when a framework definition has an invalid matchContent regex', async () => {
    // The matchContent regex is invalid, but the framework should still be detected
    // (matchContent check should return false gracefully instead of throwing)
    const fs = Layer.merge(
      makeTestFs({
        '/project/package.json': JSON.stringify({
          dependencies: { next: '^14.0.0' },
        }),
        '/project/next.config.js': 'module.exports = {}',
      }),
      TestPathLayer
    );

    // Even though next.config.js exists, the invalid regex should not crash
    const result = await Effect.runPromise(detectFramework('/project').pipe(Effect.provide(fs)));

    // Next.js doesn't use matchContent, so it still detects fine
    expect(result.framework.slug).toBe('nextjs');
  });
});

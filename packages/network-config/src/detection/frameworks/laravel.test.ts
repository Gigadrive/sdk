import { describe, expect, it } from 'vitest';
import { composerJson, detectProject, detectProjectError } from './test-utils';

const lockfileCases: Array<{ name: string; lockfile: Record<string, string> }> = [
  { name: 'no lockfile', lockfile: {} },
  { name: 'composer.lock', lockfile: { '/project/composer.lock': '' } },
  { name: 'package-lock.json', lockfile: { '/project/package-lock.json': '' } },
  { name: 'pnpm-lock.yaml', lockfile: { '/project/pnpm-lock.yaml': '' } },
  { name: 'bun.lockb', lockfile: { '/project/bun.lockb': '' } },
];

describe('Laravel framework detection', () => {
  it.each(lockfileCases)('should use composer install for Laravel projects with $name', async ({ lockfile }) => {
    const result = await detectProject({
      '/project/composer.json': composerJson({ php: '^8.3', 'laravel/framework': '^11.0' }),
      '/project/artisan': '#!/usr/bin/env php',
      ...lockfile,
    });

    expect(result.packageManager).toBe('composer');
    expect(result.config.commands[0]).toBe('composer install');
  });

  it('should detect Laravel and generate public PHP entrypoint config', async () => {
    const result = await detectProject({
      '/project/composer.json': composerJson({ php: '^8.3', 'laravel/framework': '^11.0' }),
      '/project/artisan': '#!/usr/bin/env php',
      '/project/composer.lock': '',
    });

    expect(result.framework).toMatchObject({ slug: 'laravel', name: 'Laravel' });
    expect(result.packageManager).toBe('composer');
    expect(result.config.commands).toEqual([
      'composer install',
      'composer require bref/laravel-bridge --update-with-dependencies',
      'bun install',
      'bun run build',
    ]);
    expect(result.config.entrypoints).toEqual([
      expect.objectContaining({
        path: 'public/index.php',
        runtime: 'php-84',
        memory: 256,
        maxDuration: 30,
        streaming: false,
      }),
    ]);
    expect(result.config.routes).toEqual([expect.objectContaining({ path: '/*', destination: 'public/index.php' })]);
    expect(result.config.assets).toMatchObject({ prefixToStrip: 'public/', populateCache: true });
    expect(result.config.excludeFiles).toEqual(['tests/', 'storage/', '.ddev', 'node_modules/']);
    expect(result.config.environmentVariables).toMatchObject({
      APP_ENV: 'production',
      APP_DEBUG: 'false',
      LOG_CHANNEL: 'stderr',
      SESSION_DRIVER: 'cookie',
    });
  });

  it('should require the artisan file in addition to laravel/framework', async () => {
    const result = await detectProjectError({
      '/project/composer.json': composerJson({ 'laravel/framework': '^11.0' }),
    });

    expect(result).toHaveProperty('error');
  });

  it('should not detect Laravel from artisan without laravel/framework', async () => {
    const result = await detectProjectError({
      '/project/composer.json': composerJson({ php: '^8.3' }),
      '/project/artisan': '#!/usr/bin/env php',
    });

    expect(result).toHaveProperty('error');
  });
});

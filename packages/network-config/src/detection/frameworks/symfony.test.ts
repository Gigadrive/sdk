import { describe, expect, it } from 'vitest';
import { composerJson, detectProject, detectProjectError, packageJson } from './test-utils';

const lockfileCases: Array<{ name: string; lockfile: Record<string, string> }> = [
  { name: 'no lockfile', lockfile: {} },
  { name: 'composer.lock', lockfile: { '/project/composer.lock': '' } },
  { name: 'package-lock.json', lockfile: { '/project/package-lock.json': '' } },
  { name: 'pnpm-lock.yaml', lockfile: { '/project/pnpm-lock.yaml': '' } },
  { name: 'bun.lockb', lockfile: { '/project/bun.lockb': '' } },
];

describe('Symfony framework detection', () => {
  it.each(lockfileCases)(
    'should use optimized composer install for Symfony projects with $name',
    async ({ lockfile }) => {
      const result = await detectProject({
        '/project/composer.json': composerJson({ php: '^8.3', 'symfony/framework-bundle': '^7.0' }),
        '/project/bin/console': '#!/usr/bin/env php',
        ...lockfile,
      });

      expect(result.packageManager).toBe('composer');
      expect(result.config.commands[0]).toBe('composer install --prefer-dist --optimize-autoloader --no-dev');
    }
  );

  it('should detect Symfony and generate public PHP entrypoint config', async () => {
    const result = await detectProject({
      '/project/composer.json': composerJson({ php: '^8.3', 'symfony/framework-bundle': '^7.0' }),
      '/project/bin/console': '#!/usr/bin/env php',
      '/project/package.json': packageJson({ vite: '^7.0.0' }),
      '/project/bun.lockb': '',
    });

    expect(result.framework).toMatchObject({ slug: 'symfony', name: 'Symfony' });
    expect(result.config.commands).toEqual([
      'composer install --prefer-dist --optimize-autoloader --no-dev',
      'bun install',
      'bun run build',
    ]);
    expect(result.config.entrypoints).toEqual([
      expect.objectContaining({
        path: 'public/index.php',
        runtime: 'php-84',
        memory: 512,
        maxDuration: 30,
        streaming: false,
        symlinks: { var: '/tmp' },
      }),
    ]);
    expect(result.config.routes).toEqual([expect.objectContaining({ path: '/*', destination: 'public/index.php' })]);
    expect(result.config.assets).toMatchObject({ prefixToStrip: 'public/', populateCache: true });
    expect(result.config.excludeFiles).toEqual(['tests/*', '.ddev', 'var']);
    expect(result.config.environmentVariables).toMatchObject({
      APP_ENV: 'prod',
      APP_DEBUG: 'false',
      MESSENGER_TRANSPORT_DSN: 'doctrine://default?auto_setup=0',
    });
  });

  it('should require bin/console in addition to symfony/framework-bundle', async () => {
    const result = await detectProjectError({
      '/project/composer.json': composerJson({ 'symfony/framework-bundle': '^7.0' }),
    });

    expect(result).toHaveProperty('error');
  });

  it('should not detect Symfony from bin/console without symfony/framework-bundle', async () => {
    const result = await detectProjectError({
      '/project/composer.json': composerJson({ php: '^8.3' }),
      '/project/bin/console': '#!/usr/bin/env php',
    });

    expect(result).toHaveProperty('error');
  });
});

import { describe, expect, it } from 'vitest';
import { phpRuntimeForConstraint } from './php-runtime';
import { composerJson, detectProject } from './test-utils';

const laravelProject = (composer: string) => ({
  '/project/composer.json': composer,
  '/project/artisan': '#!/usr/bin/env php',
  '/project/public/index.php': '<?php',
});

describe('phpRuntimeForConstraint', () => {
  it.each([
    { constraint: '^8.2', runtime: 'php-84' },
    { constraint: '>=8.1', runtime: 'php-84' },
    { constraint: '*', runtime: 'php-84' },
    { constraint: '~8.3.0', runtime: 'php-83' },
    { constraint: '8.3.*', runtime: 'php-83' },
    { constraint: '>=8.1 <8.4', runtime: 'php-83' },
    { constraint: '8.1 - 8.3', runtime: 'php-83' },
    // Composer reads `<=8.4` as `<=8.4.0`, which no current 8.4 release satisfies.
    { constraint: '<=8.4', runtime: 'php-83' },
    { constraint: '^7.4 || ~8.3.0', runtime: 'php-83' },
  ])('should pick $runtime for $constraint', ({ constraint, runtime }) => {
    expect(phpRuntimeForConstraint(constraint)).toBe(runtime);
  });

  it.each(['~8.1.0', '^7.4', '^8.5', 'dev-main', ''])('should pick no runtime for %j', (constraint) => {
    // php-81 is deprecated, so a constraint that only allows it is not honored.
    expect(phpRuntimeForConstraint(constraint)).toBeUndefined();
  });
});

describe('PHP runtime from composer.json', () => {
  it.each([
    { constraint: '^8.2', runtime: 'php-84' },
    { constraint: '~8.3.0', runtime: 'php-83' },
    { constraint: '>=8.1 <8.4', runtime: 'php-83' },
    { constraint: '~8.1.0', runtime: 'php-84' },
    { constraint: 'not a constraint', runtime: 'php-84' },
  ])('should run Laravel requiring PHP $constraint on $runtime', async ({ constraint, runtime }) => {
    const result = await detectProject(laravelProject(composerJson({ php: constraint, 'laravel/framework': '^12.0' })));

    expect(result.framework.slug).toBe('laravel');
    expect(result.config.entrypoints).toEqual([expect.objectContaining({ path: 'public/index.php', runtime })]);
  });

  it.each([
    { name: 'no PHP requirement', composer: composerJson({ 'laravel/framework': '^12.0' }) },
    {
      name: 'a non-string PHP requirement',
      composer: JSON.stringify({ require: { php: 8.3, 'laravel/framework': '^12.0' } }),
    },
  ])('should keep php-84 for Laravel with $name', async ({ composer }) => {
    const result = await detectProject(laravelProject(composer));

    expect(result.config.entrypoints).toEqual([expect.objectContaining({ runtime: 'php-84' })]);
  });

  it.each([
    {
      name: 'Symfony',
      slug: 'symfony',
      files: {
        '/project/composer.json': composerJson({ php: '~8.3.0', 'symfony/framework-bundle': '^7.0' }),
        '/project/bin/console': '#!/usr/bin/env php',
      },
    },
    {
      name: 'CakePHP',
      slug: 'cakephp',
      files: {
        '/project/composer.json': composerJson({ php: '8.3.*', 'cakephp/cakephp': '^5.0' }),
        '/project/webroot/index.php': '<?php',
      },
    },
    {
      name: 'Slim',
      slug: 'slim',
      files: {
        '/project/composer.json': composerJson({ php: '>=8.1 <8.4', 'slim/slim': '^4.14' }),
        '/project/public/index.php': '<?php',
      },
    },
    {
      // The generic preset refines its document root first; the runtime survives it.
      name: 'a generic Composer project',
      slug: 'php',
      files: {
        '/project/composer.json': composerJson({ php: '~8.3.0' }),
        '/project/web/index.php': '<?php',
      },
    },
  ])('should run $name on php-83 when composer.json requires PHP 8.3', async ({ slug, files }) => {
    const result = await detectProject(files);

    expect(result.framework.slug).toBe(slug);
    expect(result.config.entrypoints).toEqual([expect.objectContaining({ runtime: 'php-83' })]);
  });

  it('should keep the document root the generic preset found', async () => {
    const result = await detectProject({
      '/project/composer.json': composerJson({ php: '~8.3.0' }),
      '/project/web/index.php': '<?php',
    });

    expect(result.config.entrypoints).toEqual([expect.objectContaining({ path: 'web/index.php', runtime: 'php-83' })]);
  });

  it('should keep php-84 for plain PHP files without composer.json', async () => {
    const result = await detectProject({ '/project/index.php': '<?php' });

    expect(result.framework.slug).toBe('php-site');
    expect(result.config.entrypoints).toEqual([expect.objectContaining({ runtime: 'php-84' })]);
  });
});

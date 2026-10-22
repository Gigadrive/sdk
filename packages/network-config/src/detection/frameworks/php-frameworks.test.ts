import { describe, expect, it } from 'vitest';
import { composerJson, detectProject, detectProjectError, packageJson } from './test-utils';

const cases = [
  {
    name: 'CakePHP',
    slug: 'cakephp',
    files: {
      '/project/composer.json': composerJson({ 'cakephp/cakephp': '^5.0' }),
      '/project/webroot/index.php': '<?php',
      '/project/webroot/css/cake.css': 'body{}',
      '/project/config/app_local.php': '<?php return [];',
    },
    documentRoot: 'webroot',
    asset: 'webroot/css/cake.css',
    writablePaths: ['tmp/cache/models', 'tmp/cache/persistent', 'tmp/cache/views', 'tmp/sessions', 'tmp/tests', 'logs'],
  },
  {
    name: 'CodeIgniter',
    slug: 'codeigniter',
    files: {
      '/project/composer.json': composerJson({ 'codeigniter4/framework': '^4.6' }),
      '/project/spark': '#!/usr/bin/env php',
      '/project/public/index.php': '<?php',
      '/project/public/favicon.ico': 'icon',
    },
    documentRoot: 'public',
    asset: 'public/favicon.ico',
    writablePaths: ['writable/cache', 'writable/debugbar', 'writable/logs', 'writable/session', 'writable/uploads'],
  },
  {
    name: 'Laminas MVC',
    slug: 'laminas',
    files: {
      '/project/composer.json': composerJson({ 'laminas/laminas-mvc': '^3.8' }),
      '/project/public/index.php': '<?php',
      '/project/public/css/style.css': 'body{}',
    },
    documentRoot: 'public',
    asset: 'public/css/style.css',
    writablePaths: ['data/cache'],
  },
  {
    name: 'Mezzio',
    slug: 'mezzio',
    files: {
      '/project/composer.json': composerJson({ 'mezzio/mezzio': '^3.20' }),
      '/project/public/index.php': '<?php',
      '/project/public/robots.txt': 'User-agent: *',
    },
    documentRoot: 'public',
    asset: 'public/robots.txt',
    writablePaths: ['data/cache'],
  },
  {
    name: 'Slim',
    slug: 'slim',
    files: {
      '/project/composer.json': composerJson({ 'slim/slim': '^4.14' }),
      '/project/public/index.php': '<?php',
      '/project/public/app.js': 'console.log(1)',
    },
    documentRoot: 'public',
    asset: 'public/app.js',
    writablePaths: ['logs', 'var/cache'],
  },
  {
    name: 'Yii 2',
    slug: 'yii',
    files: {
      '/project/composer.json': composerJson({ 'yiisoft/yii2': '~2.0.51' }),
      '/project/web/index.php': '<?php',
      '/project/web/css/site.css': 'body{}',
    },
    documentRoot: 'web',
    asset: 'web/css/site.css',
    writablePaths: ['runtime', 'web/assets'],
  },
];

describe('PHP framework presets', () => {
  it.each(cases)(
    'should serve $name from its document root without configuration',
    async ({ slug, name, files, documentRoot, asset, writablePaths }) => {
      const result = await detectProject({
        ...files,
        '/project/composer.lock': '',
        [`/project/${documentRoot}/info.php`]: '<?php phpinfo();',
        '/project/src/Secret.php': '<?php',
      });

      expect(result.framework).toMatchObject({ slug, name, language: 'php' });
      expect(result.packageManager).toBe('composer');
      expect(result.config.commands).toEqual(['composer install']);
      expect(result.config.entrypoints).toEqual([
        expect.objectContaining({
          path: `${documentRoot}/index.php`,
          runtime: 'php-84',
          memory: 256,
          package: { writablePaths },
        }),
      ]);
      expect(result.config.routes).toEqual([
        expect.objectContaining({ path: '/*', destination: `${documentRoot}/index.php` }),
      ]);
      // Only the document root is published, and no PHP file inside it.
      expect(result.config.assets?.paths).toEqual([asset]);
      expect(result.config.assets?.prefixToStrip).toBe(`${documentRoot}/`);
    }
  );

  it('should rank every framework preset above the generic PHP fallback', async () => {
    const result = await detectProject({
      '/project/composer.json': composerJson({ 'slim/slim': '^4.14', 'laminas/laminas-mvc': '^3.8' }),
      '/project/public/index.php': '<?php',
    });

    expect(result.framework.slug).toBe('laminas');
  });

  it('should keep a PHP application with a Vite front end on PHP', async () => {
    const result = await detectProject({
      '/project/composer.json': composerJson({ 'slim/slim': '^4.14' }),
      '/project/public/index.php': '<?php',
      '/project/package.json': packageJson({ vite: '^7.0.0' }),
    });

    expect(result.framework.slug).toBe('slim');
  });
});

describe('generic PHP fallback', () => {
  it.each([
    ['public', '/project/public/index.php'],
    ['web', '/project/web/index.php'],
    ['webroot', '/project/webroot/index.php'],
    ['public_html', '/project/public_html/index.php'],
    ['htdocs', '/project/htdocs/index.php'],
  ])('should find a front controller in %s/', async (documentRoot, frontController) => {
    const result = await detectProject({
      '/project/composer.json': composerJson({ 'monolog/monolog': '^3.0' }),
      [frontController]: '<?php',
      [`/project/${documentRoot}/style.css`]: 'body{}',
      '/project/src/App.php': '<?php',
    });

    expect(result.framework).toMatchObject({ slug: 'php', language: 'php' });
    expect(result.config.entrypoints).toEqual([expect.objectContaining({ path: `${documentRoot}/index.php` })]);
    expect(result.config.assets?.paths).toEqual([`${documentRoot}/style.css`]);
    expect(result.config.assets?.prefixToStrip).toBe(`${documentRoot}/`);
  });

  it('should prefer public/ over a root index.php', async () => {
    const result = await detectProject({
      '/project/composer.json': composerJson({}),
      '/project/index.php': '<?php',
      '/project/public/index.php': '<?php',
    });

    expect(result.config.entrypoints).toEqual([expect.objectContaining({ path: 'public/index.php' })]);
  });

  it('should serve a project-root front controller without publishing Composer files', async () => {
    const result = await detectProject({
      '/project/composer.json': composerJson({}),
      '/project/composer.lock': '{}',
      '/project/index.php': '<?php',
      '/project/style.css': 'body{}',
      '/project/lib/db.php': '<?php',
    });

    expect(result.config.entrypoints).toEqual([expect.objectContaining({ path: 'index.php' })]);
    expect(result.config.routes).toEqual([expect.objectContaining({ path: '/*', destination: 'index.php' })]);
    expect(result.config.excludeFiles).toEqual(expect.arrayContaining(['composer.json', 'composer.lock']));
    // composer.json and composer.lock stay listed here; excludeFiles keeps them off the edge.
    expect(result.config.assets?.paths).toEqual(expect.arrayContaining(['./style.css']));
    expect(result.config.assets?.paths).not.toEqual(expect.arrayContaining(['./lib/db.php', './index.php']));
  });

  it('should not detect a Composer project without a front controller', async () => {
    const result = await detectProjectError({
      '/project/composer.json': composerJson({ 'monolog/monolog': '^3.0' }),
      '/project/src/App.php': '<?php',
    });

    expect(result).toHaveProperty('error');
  });

  it('should fall back to generic PHP when a framework is missing its marker file', async () => {
    const result = await detectProject({
      '/project/composer.json': composerJson({ 'laravel/framework': '^13.0' }),
      '/project/public/index.php': '<?php',
    });

    expect(result.framework.slug).toBe('php');
    expect(result.config.entrypoints).toEqual([expect.objectContaining({ path: 'public/index.php' })]);
  });

  it('should never publish dotfiles or dependencies from a project-root document root', async () => {
    const result = await detectProject({
      '/project/composer.json': composerJson({}),
      '/project/index.php': '<?php',
      '/project/style.css': 'body{}',
      '/project/.env': 'DB_PASSWORD=secret',
      '/project/.git/config': '[core]',
      '/project/config/.env.local': 'SECRET=1',
      '/project/vendor/autoload.php': '<?php',
      '/project/vendor/acme/lib/readme.txt': 'docs',
      '/project/node_modules/pkg/index.js': 'x',
    });

    expect(result.config.assets?.paths).toEqual(['./style.css']);
  });

  it('should detect plain PHP files without Composer', async () => {
    const result = await detectProject({
      '/project/index.php': '<?php echo "hi";',
      '/project/about.php': '<?php',
      '/project/logo.png': 'png',
    });

    expect(result.framework).toMatchObject({ slug: 'php-site', language: 'php' });
    expect(result.packageManager).toBe('composer');
    // There is no manifest, so there is nothing to install.
    expect(result.config.commands).toEqual([]);
    expect(result.config.entrypoints).toEqual([expect.objectContaining({ path: 'index.php' })]);
    expect(result.config.assets?.paths).toEqual(['./logo.png']);
  });
});

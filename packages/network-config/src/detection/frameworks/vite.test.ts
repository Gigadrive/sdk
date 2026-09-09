import { describe, expect, it } from 'vitest';
import {
  detectProject,
  expectNodePackageManagerPriority,
  expectNodePackageManagerVariants,
  packageJson,
} from './test-utils';

const dependencies = { vite: '^7.0.0', react: '^19.0.0' };

describe('Vite framework detection', () => {
  expectNodePackageManagerVariants('Vite', dependencies, 'vite build');
  expectNodePackageManagerPriority(dependencies);

  it('should detect Vite and generate static asset config without server entrypoints', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
    });

    expect(result.framework).toMatchObject({ slug: 'vite', name: 'Vite' });
    expect(result.config.commands).toEqual(['npm install', 'vite build']);
    expect(result.config.entrypoints).toEqual([]);
    expect(result.config.routes).toEqual([]);
    expect(result.config.assets).toMatchObject({ prefixToStrip: 'dist/', populateCache: true });
    expect(result.config.environmentVariables).toEqual({ NODE_ENV: 'production' });
  });

  it('should publish the built dist directory as static assets', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/dist/index.html': '<html></html>',
      '/project/dist/assets/index-abc123.js': 'console.log(1)',
      '/project/dist/assets/index-abc123.css': 'body{}',
      '/project/dist/favicon.svg': '<svg />',
      '/project/src/main.tsx': 'ignored',
      '/project/vite.config.ts': 'ignored',
    });

    expect(result.config.assets?.paths).toEqual([
      'dist/assets/index-abc123.css',
      'dist/assets/index-abc123.js',
      'dist/favicon.svg',
      'dist/index.html',
    ]);
  });

  it('should serve prerendered pages at their extensionless route', async () => {
    const result = await detectProject({
      '/project/package.json': packageJson(dependencies),
      '/project/dist/index.html': '<html></html>',
      '/project/dist/about/index.html': '<html></html>',
      '/project/dist/portfolio/index.html': '<html></html>',
      '/project/dist/404.html': '<html></html>',
      '/project/dist/sitemap.xml': '<urlset />',
    });

    expect(result.config.assets?.overrides).toEqual({
      'index.html': { path: '' },
      'about/index.html': { path: 'about' },
      'portfolio/index.html': { path: 'portfolio' },
    });
    // Files that are not directory indexes keep their literal public path.
    expect(result.config.assets?.paths).toContain('dist/404.html');
    expect(result.config.assets?.paths).toContain('dist/sitemap.xml');
  });
});

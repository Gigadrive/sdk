import type { FrameworkDefinition } from '../types';
import { astro } from './astro';
import { bridgetown } from './bridgetown';
import { cakephp } from './cakephp';
import { codeigniter } from './codeigniter';
import { elysia } from './elysia';
import { express } from './express';
import { fastify } from './fastify';
import { hanami } from './hanami';
import { hono } from './hono';
import { jekyllPresets } from './jekyll';
import { laminas } from './laminas';
import { laravel } from './laravel';
import { mezzio } from './mezzio';
import { nestjs } from './nestjs';
import { nextjs } from './nextjs';
import { nuxt } from './nuxt';
import { phpComposerProjects, phpSites } from './php';
import { withComposerPhpRuntime } from './php-runtime';
import { rack } from './rack';
import { railsPresets } from './rails';
import { remix } from './remix';
import { roda } from './roda';
import { withRubyRuntime } from './ruby-runtime';
import { sinatra } from './sinatra';
import { slim } from './slim';
import { sveltekit } from './sveltekit';
import { symfony } from './symfony';
import { vite } from './vite';
import { yii } from './yii';

export { detectRubyRuntime } from './ruby-runtime';

/**
 * All supported framework definitions, sorted by priority descending.
 * Higher priority frameworks are checked first during detection. Every PHP
 * preset picks its runtime from `composer.json` `require.php`
 * ({@link withComposerPhpRuntime}), and every Ruby preset from the project's
 * Ruby version ({@link withRubyRuntime}).
 */
export const FRAMEWORK_DEFINITIONS: FrameworkDefinition[] = [
  nextjs,
  nuxt,
  nestjs,
  remix,
  sveltekit,
  astro,
  laravel,
  symfony,
  cakephp,
  codeigniter,
  laminas,
  mezzio,
  yii,
  slim,
  ...railsPresets,
  hanami,
  ...jekyllPresets,
  bridgetown,
  sinatra,
  roda,
  hono,
  elysia,
  fastify,
  express,
  rack,
  ...phpComposerProjects,
  ...phpSites,
  vite,
]
  .map((framework) => {
    switch (framework.language) {
      case 'php':
        return withComposerPhpRuntime(framework);
      case 'ruby':
        return withRubyRuntime(framework);
      case 'node':
        return framework;
    }
  })
  .sort((a, b) => b.priority - a.priority);

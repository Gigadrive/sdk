import type { FrameworkDefinition } from '../types';
import { astro } from './astro';
import { cakephp } from './cakephp';
import { codeigniter } from './codeigniter';
import { elysia } from './elysia';
import { express } from './express';
import { fastify } from './fastify';
import { hono } from './hono';
import { laminas } from './laminas';
import { laravel } from './laravel';
import { mezzio } from './mezzio';
import { nestjs } from './nestjs';
import { nextjs } from './nextjs';
import { nuxt } from './nuxt';
import { phpComposerProjects, phpSites } from './php';
import { withComposerPhpRuntime } from './php-runtime';
import { remix } from './remix';
import { slim } from './slim';
import { sveltekit } from './sveltekit';
import { symfony } from './symfony';
import { vite } from './vite';
import { yii } from './yii';

/**
 * All supported framework definitions, sorted by priority descending.
 * Higher priority frameworks are checked first during detection. Every PHP
 * preset picks its runtime from `composer.json` `require.php`
 * ({@link withComposerPhpRuntime}).
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
  hono,
  elysia,
  fastify,
  express,
  ...phpComposerProjects,
  ...phpSites,
  vite,
]
  .map((framework) => (framework.language === 'php' ? withComposerPhpRuntime(framework) : framework))
  .sort((a, b) => b.priority - a.priority);

import type { FrameworkDefinition } from '../types';
import { astro } from './astro';
import { elysia } from './elysia';
import { express } from './express';
import { fastify } from './fastify';
import { hono } from './hono';
import { laravel } from './laravel';
import { nestjs } from './nestjs';
import { nextjs } from './nextjs';
import { nuxt } from './nuxt';
import { remix } from './remix';
import { sveltekit } from './sveltekit';
import { symfony } from './symfony';
import { vite } from './vite';

/**
 * All supported framework definitions, sorted by priority descending.
 * Higher priority frameworks are checked first during detection.
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
  hono,
  elysia,
  fastify,
  express,
  vite,
].sort((a, b) => b.priority - a.priority);

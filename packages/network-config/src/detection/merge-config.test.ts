import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import type { NormalizedConfig } from '../normalized-config';
import { mergeWithFrameworkDefaults } from './merge-config';

const makeConfig = (overrides: Partial<NormalizedConfig> = {}): NormalizedConfig => ({
  regions: ['us-east-1'],
  commands: [],
  entrypoints: [],
  routes: [],
  environmentVariables: {},
  warnings: [],
  errors: [],
  ...overrides,
});

describe('mergeWithFrameworkDefaults', () => {
  it('should use user commands when non-empty', async () => {
    const user = makeConfig({ commands: ['npm run build'] });
    const framework = makeConfig({ commands: ['next build'] });

    const result = await Effect.runPromise(mergeWithFrameworkDefaults(user, framework));
    expect(result.commands).toEqual(['npm run build']);
  });

  it('should use framework commands when user commands are empty', async () => {
    const user = makeConfig({ commands: [] });
    const framework = makeConfig({ commands: ['next build'] });

    const result = await Effect.runPromise(mergeWithFrameworkDefaults(user, framework));
    expect(result.commands).toEqual(['next build']);
  });

  it('should use user entrypoints when non-empty', async () => {
    const userEntrypoint = { path: 'custom.js', runtime: 'node-22' as const, memory: 512, maxDuration: 60 };
    const frameworkEntrypoint = { path: 'dist/main.js', runtime: 'node-22' as const, memory: 256, maxDuration: 30 };

    const user = makeConfig({ entrypoints: [userEntrypoint] });
    const framework = makeConfig({ entrypoints: [frameworkEntrypoint] });

    const result = await Effect.runPromise(mergeWithFrameworkDefaults(user, framework));
    expect(result.entrypoints).toEqual([userEntrypoint]);
  });

  it('should use framework entrypoints when user has none', async () => {
    const frameworkEntrypoint = { path: 'dist/main.js', runtime: 'node-22' as const, memory: 256, maxDuration: 30 };

    const user = makeConfig({ entrypoints: [] });
    const framework = makeConfig({ entrypoints: [frameworkEntrypoint] });

    const result = await Effect.runPromise(mergeWithFrameworkDefaults(user, framework));
    expect(result.entrypoints).toEqual([frameworkEntrypoint]);
  });

  it('should use user routes when non-empty', async () => {
    const userRoute = {
      path: '/api/*',
      destination: 'api.js',
      handler: 'SERVERLESS_FUNCTION' as const,
      methods: ['ANY' as const],
      headers: {},
    };
    const frameworkRoute = {
      path: '/*',
      destination: 'dist/main.js',
      handler: 'SERVERLESS_FUNCTION' as const,
      methods: ['ANY' as const],
      headers: {},
    };

    const user = makeConfig({ routes: [userRoute] });
    const framework = makeConfig({ routes: [frameworkRoute] });

    const result = await Effect.runPromise(mergeWithFrameworkDefaults(user, framework));
    expect(result.routes).toEqual([userRoute]);
  });

  it('should use framework routes when user has none', async () => {
    const frameworkRoute = {
      path: '/*',
      destination: 'dist/main.js',
      handler: 'SERVERLESS_FUNCTION' as const,
      methods: ['ANY' as const],
      headers: {},
    };

    const user = makeConfig({ routes: [] });
    const framework = makeConfig({ routes: [frameworkRoute] });

    const result = await Effect.runPromise(mergeWithFrameworkDefaults(user, framework));
    expect(result.routes).toEqual([frameworkRoute]);
  });

  it('should deep merge environment variables with user taking precedence', async () => {
    const user = makeConfig({ environmentVariables: { NODE_ENV: 'development', CUSTOM: 'value' } });
    const framework = makeConfig({ environmentVariables: { NODE_ENV: 'production', FRAMEWORK_KEY: 'default' } });

    const result = await Effect.runPromise(mergeWithFrameworkDefaults(user, framework));
    expect(result.environmentVariables).toEqual({
      NODE_ENV: 'development',
      FRAMEWORK_KEY: 'default',
      CUSTOM: 'value',
    });
  });

  it('should always use user regions', async () => {
    const user = makeConfig({ regions: ['eu-central-1'] });
    const framework = makeConfig({ regions: ['us-east-1', 'us-west-1'] });

    const result = await Effect.runPromise(mergeWithFrameworkDefaults(user, framework));
    expect(result.regions).toEqual(['eu-central-1']);
  });

  it('should always use user services', async () => {
    const user = makeConfig({ services: [{ type: 'redis' }] });
    const framework = makeConfig({});

    const result = await Effect.runPromise(mergeWithFrameworkDefaults(user, framework));
    expect(result.services).toEqual([{ type: 'redis' }]);
  });

  it('should concatenate warnings from both configs', async () => {
    const user = makeConfig({ warnings: ['user warning'] });
    const framework = makeConfig({ warnings: ['framework warning'] });

    const result = await Effect.runPromise(mergeWithFrameworkDefaults(user, framework));
    expect(result.warnings).toEqual(['framework warning', 'user warning']);
  });

  it('should concatenate errors from both configs', async () => {
    const user = makeConfig({ errors: ['user error'] });
    const framework = makeConfig({ errors: ['framework error'] });

    const result = await Effect.runPromise(mergeWithFrameworkDefaults(user, framework));
    expect(result.errors).toEqual(['framework error', 'user error']);
  });

  it('should use user assets when user has paths', async () => {
    const userAssets = { paths: ['public/index.html'], prefixToStrip: 'public/' };
    const frameworkAssets = { paths: [], prefixToStrip: 'dist/' };

    const user = makeConfig({ assets: userAssets });
    const framework = makeConfig({ assets: frameworkAssets });

    const result = await Effect.runPromise(mergeWithFrameworkDefaults(user, framework));
    expect(result.assets).toEqual(userAssets);
  });

  it('should use framework assets when user has no asset paths', async () => {
    const frameworkAssets = { paths: [], prefixToStrip: 'dist/', dynamicRoutes: true, populateCache: true };

    const user = makeConfig({ assets: { paths: [] } });
    const framework = makeConfig({ assets: frameworkAssets });

    const result = await Effect.runPromise(mergeWithFrameworkDefaults(user, framework));
    expect(result.assets).toEqual(frameworkAssets);
  });
});

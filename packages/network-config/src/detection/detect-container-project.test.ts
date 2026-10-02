import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import { makeTestFs, TestPathLayer } from '../test-utils';
import { detectContainerProject } from './detect-container-project';

const detect = (files: Record<string, string>) =>
  Effect.runPromise(
    Effect.either(
      detectContainerProject('/project').pipe(Effect.provide(Layer.merge(makeTestFs(files), TestPathLayer)))
    )
  );

describe('detectContainerProject', () => {
  it('returns undefined when there is neither a Compose file nor a Dockerfile', async () => {
    expect(await detect({ '/project/README.md': '# hi' })).toMatchObject({ _tag: 'Right', right: undefined });
  });

  it('deploys a root Dockerfile as one container function behind a catch-all route', async () => {
    const result = await detect({ '/project/Dockerfile': 'FROM golang:1.23' });

    if (result._tag === 'Left' || result.right === undefined) throw new Error('expected a detection');
    expect(result.right.kind).toBe('dockerfile');
    expect(result.right.file).toBe('Dockerfile');
    expect(result.right.config).toEqual({
      regions: expect.any(Array),
      environmentVariables: {},
      commands: [],
      entrypoints: [
        {
          path: 'container:app',
          displayName: 'app',
          runtime: 'docker',
          memory: 512,
          maxDuration: 30,
          streaming: true,
          container: { name: 'app', source: { type: 'dockerfile', context: '.', dockerfile: 'Dockerfile' } },
        },
      ],
      routes: [
        {
          path: '/*',
          destination: 'container:app',
          handler: 'SERVERLESS_FUNCTION_STREAMING',
          methods: ['ANY'],
          headers: {},
        },
      ],
      warnings: ['Auto-detected Dockerfile project (Dockerfile). Create a gigadrive.yaml to customize.'],
      errors: [],
    });
  });

  it('prefers a Compose file over a Dockerfile, in docker compose lookup order', async () => {
    const result = await detect({
      '/project/Dockerfile': 'FROM python:3.13',
      '/project/docker-compose.yml': 'services:\n  ignored:\n    image: nginx\n    ports: ["80"]\n',
      '/project/compose.yaml':
        'services:\n  web:\n    build: .\n    ports: ["8000"]\n  redis:\n    image: redis:7\n    volumes: [data:/data]\n',
    });

    if (result._tag === 'Left' || result.right === undefined) throw new Error('expected a detection');
    expect(result.right.kind).toBe('compose');
    expect(result.right.file).toBe('compose.yaml');
    expect(result.right.config.entrypoints.map((entrypoint) => entrypoint.path)).toEqual(['container:web']);
    expect(result.right.config.sidecars).toEqual([
      { name: 'redis', source: { type: 'registry', reference: 'redis:7' }, memory: 256 },
    ]);
    expect(result.right.config.routes.map((route) => route.destination)).toEqual(['container:web']);
    expect(result.right.config.warnings).toEqual([
      'Auto-detected Docker Compose project (compose.yaml). Create a gigadrive.yaml to customize.',
      "Compose service 'redis' declares volumes. Containers on Gigadrive Network have no persistent volumes, so anything written there is lost when the instance stops.",
    ]);
  });

  it('fails with the Compose error when the file cannot be deployed', async () => {
    const result = await detect({ '/project/compose.yml': 'services:\n  cache:\n    image: redis\n' });

    expect(result._tag === 'Left' && result.left.message).toContain('has no service that builds from source');
  });
});

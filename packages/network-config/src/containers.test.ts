import { Effect, Either, Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import { containerEntrypointPath, normalizeContainers, readComposeContainers, splitCommandWords } from './containers';
import { makeTestFs, TestPathLayer } from './test-utils';
import type { ConfigV4Container } from './v4';

const run = <A, E>(
  effect: Effect.Effect<A, E, Effect.Effect.Context<ReturnType<typeof normalizeContainers>>>,
  files: Record<string, string>
) => Effect.runPromise(Effect.either(effect.pipe(Effect.provide(Layer.merge(makeTestFs(files), TestPathLayer)))));

const normalize = (containers: Record<string, ConfigV4Container>, files: Record<string, string> = {}) =>
  run(normalizeContainers(containers, '/project'), files);

const readCompose = (compose: string, files: Record<string, string> = {}, file = 'docker-compose.yml') =>
  run(readComposeContainers(file, '/project'), { [`/project/${file}`]: compose, ...files });

describe('splitCommandWords', () => {
  it.each([
    ['redis-server --appendonly yes', ['redis-server', '--appendonly', 'yes']],
    ['sh -c "echo hello world"', ['sh', '-c', 'echo hello world']],
    ["echo 'single $quoted'", ['echo', 'single $quoted']],
    ['redis-server --save ""', ['redis-server', '--save', '']],
    ['a\\ b  c', ['a b', 'c']],
    ['  leading   and trailing  ', ['leading', 'and', 'trailing']],
    ['say "it\\"s"', ['say', 'it"s']],
    ['', []],
  ])('splits %j', (input, expected) => {
    expect(splitCommandWords(input)).toEqual(expected);
  });

  it('rejects an unterminated quote', () => {
    expect(() => splitCommandWords('echo "open')).toThrow('Unterminated " quote');
  });
});

describe('containerEntrypointPath', () => {
  it('prefixes the name', () => {
    expect(containerEntrypointPath('web')).toBe('container:web');
  });
});

describe('normalizeContainers', () => {
  it('turns a registry image into a container function with defaults', async () => {
    const result = await normalize({ web: { image: 'nginx:1.27' } });

    expect(result).toEqual(
      Either.right({
        entrypoints: [
          {
            path: 'container:web',
            displayName: 'web',
            runtime: 'docker',
            memory: 512,
            maxDuration: 30,
            streaming: true,
            container: { name: 'web', source: { type: 'registry', reference: 'nginx:1.27' } },
          },
        ],
        sidecars: [],
        warnings: [],
      })
    );
  });

  it('resolves a Dockerfile build relative to its context', async () => {
    const result = await normalize(
      {
        api: {
          build: {
            context: './services/api/',
            dockerfile: 'docker/Prod.Dockerfile',
            target: 'runtime',
            args: { A: '1' },
          },
          port: 3000,
          command: 'node dist/main.js --port 3000',
          entrypoint: ['tini', '--'],
          env: { NODE_ENV: 'production' },
          working_dir: '/app',
          user: 'node',
          memory: 1024,
          max_duration: 300,
          streaming: false,
          schedule: 'rate(1 hour)',
        },
      },
      { '/project/services/api/docker/Prod.Dockerfile': 'FROM node:22' }
    );

    expect(Either.getOrThrow(result).entrypoints).toEqual([
      {
        path: 'container:api',
        displayName: 'api',
        runtime: 'docker',
        memory: 1024,
        maxDuration: 300,
        streaming: false,
        schedule: 'rate(1 hour)',
        container: {
          name: 'api',
          source: {
            type: 'dockerfile',
            context: 'services/api',
            dockerfile: 'docker/Prod.Dockerfile',
            target: 'runtime',
            buildArgs: { A: '1' },
          },
          port: 3000,
          entrypoint: ['tini', '--'],
          command: ['node', 'dist/main.js', '--port', '3000'],
          workingDirectory: '/app',
          user: 'node',
          environmentVariables: { NODE_ENV: 'production' },
        },
      },
    ]);
  });

  it('accepts a string build context and defaults the Dockerfile name', async () => {
    const result = await normalize({ app: { build: '.' } }, { '/project/Dockerfile': 'FROM scratch' });

    expect(Either.getOrThrow(result).entrypoints[0].container?.source).toEqual({
      type: 'dockerfile',
      context: '.',
      dockerfile: 'Dockerfile',
    });
  });

  it('fails when the Dockerfile is missing', async () => {
    const result = await normalize({ app: { build: 'backend' } });

    expect(Either.getLeft(result).pipe((left) => left._tag === 'Some' && left.value.message)).toBe(
      "Container 'app' builds 'backend/Dockerfile', which does not exist."
    );
  });

  it.each(['../outside', '/etc'])('refuses a build context outside the project: %s', async (context) => {
    const result = await normalize({ app: { build: context } });

    expect(Either.isLeft(result)).toBe(true);
    expect(JSON.stringify(result)).toContain('outside the project');
  });

  it('refuses a container with both image and build', async () => {
    const result = await normalize({ app: { image: 'nginx', build: '.' } }, { '/project/Dockerfile': '' });

    expect(JSON.stringify(result)).toContain("must set exactly one of 'image' and 'build'");
  });

  it.each(['Web', 'localhost', '-web', 'a'.repeat(64), 'web.app'])('refuses the name %j', async (name) => {
    const result = await normalize({ [name]: { image: 'nginx' } });

    expect(JSON.stringify(result)).toContain('is invalid');
  });

  it('refuses an unterminated command quote', async () => {
    const result = await normalize({ app: { image: 'nginx', command: 'echo "x' } });

    expect(JSON.stringify(result)).toContain("Container 'app' has an invalid command");
  });

  it('collects sidecars with their memory and warns about function-only settings', async () => {
    const result = Either.getOrThrow(
      await normalize({
        redis: { image: 'redis:7-alpine', sidecar: true, port: 6379, max_duration: 10, schedule: 'rate(1 hour)' },
        search: { image: 'getmeili/meilisearch:v1.9', sidecar: true, memory: 512 },
      })
    );

    expect(result.entrypoints).toEqual([]);
    expect(result.sidecars).toEqual([
      { name: 'redis', source: { type: 'registry', reference: 'redis:7-alpine' }, port: 6379, memory: 256 },
      { name: 'search', source: { type: 'registry', reference: 'getmeili/meilisearch:v1.9' }, memory: 512 },
    ]);
    expect(result.warnings).toEqual([
      "Sidecar 'redis' ignores max_duration, schedule: those settings apply to container functions only.",
    ]);
  });

  it('refuses more than four sidecars', async () => {
    const result = await normalize(
      Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((name) => [name, { image: 'redis', sidecar: true }]))
    );

    expect(JSON.stringify(result)).toContain('at most 4 sidecars; this one declares 5');
  });

  it('refuses two sidecars on one port', async () => {
    const result = await normalize({
      one: { image: 'redis', sidecar: true, port: 6379 },
      two: { image: 'valkey/valkey', sidecar: true, port: 6379 },
    });

    expect(JSON.stringify(result)).toContain("Sidecars 'one' and 'two' both listen on port 6379");
  });

  it('refuses a container function and a sidecar on one port', async () => {
    const result = await normalize({
      web: { image: 'nginx', port: 6379 },
      redis: { image: 'redis', sidecar: true, port: 6379 },
    });

    expect(JSON.stringify(result)).toContain("Container 'web' and sidecar 'redis' both listen on port 6379");
  });
});

describe('readComposeContainers', () => {
  it('maps the built service to a function and the others to sidecars', async () => {
    const compose = `
services:
  web:
    build: .
    ports: ["8080:3000"]
    environment:
      REDIS_URL: redis://cache:6379
      LOG_LEVEL:
    command: npm run start
    depends_on: [cache, db]
  cache:
    image: redis:7-alpine
    command: ["redis-server", "--save", ""]
    deploy:
      resources:
        limits:
          memory: 300M
  db:
    image: postgres:17
    ports: ["5432:5432"]
    environment:
      - POSTGRES_PASSWORD=\${DB_PASSWORD:-secret}
      - PGDATA
    volumes: [db-data:/var/lib/postgresql/data]
  docs:
    image: nginx
    profiles: [tools]
volumes:
  db-data: {}
`;
    const result = Either.getOrThrow(await readCompose(compose));

    expect(result.publicService).toBe('web');
    expect(result.containers).toEqual({
      web: {
        build: { context: '.' },
        port: 3000,
        command: 'npm run start',
        env: { REDIS_URL: 'redis://cache:6379' },
      },
      cache: {
        image: 'redis:7-alpine',
        sidecar: true,
        command: ['redis-server', '--save', ''],
        memory: 300,
      },
      db: {
        image: 'postgres:17',
        sidecar: true,
        port: 5432,
        env: { POSTGRES_PASSWORD: 'secret' },
      },
    });
    expect(result.warnings).toEqual([
      "Compose service 'web' takes 'LOG_LEVEL' from the host environment, which deployments do not have. Set it in the console instead.",
      "Compose service 'db' takes 'PGDATA' from the host environment, which deployments do not have. Set it in the console instead.",
      "Compose service 'db' declares volumes. Containers on Gigadrive Network have no persistent volumes, so anything written there is lost when the instance stops.",
    ]);
  });

  it('interpolates variables from the .env file next to the Compose file', async () => {
    const compose = `
services:
  app:
    image: ghcr.io/acme/app:\${TAG}
    ports: ["\${PORT:-8000}:80"]
    environment:
      PRICE: "$$5"
      SECRET: \${MISSING}
      OTHER: $ALSO_MISSING
`;
    const result = Either.getOrThrow(
      await readCompose(compose, { '/project/.env': 'TAG=1.4.2 # pinned\n# comment\n' })
    );

    expect(result.containers.app).toEqual({
      image: 'ghcr.io/acme/app:1.4.2',
      port: 80,
      env: { PRICE: '$5', SECRET: '', OTHER: '' },
    });
    expect(result.warnings).toEqual([
      "Compose file 'docker-compose.yml' uses ALSO_MISSING, MISSING, which are not set. They were replaced with an empty string.",
    ]);
  });

  it('honours x-gigadrive markers and reads env_file', async () => {
    const compose = `
services:
  api:
    image: acme/api
    ports: ["3000"]
    x-gigadrive:
      sidecar: true
  site:
    image: acme/site
    expose: ["8080"]
    env_file: [site.env, missing.env]
    x-gigadrive:
      public: true
  debug:
    image: busybox
    x-gigadrive:
      skip: true
`;
    const result = Either.getOrThrow(await readCompose(compose, { '/project/site.env': 'MODE=prod\n' }));

    expect(result.publicService).toBe('site');
    expect(result.containers).toEqual({
      api: { image: 'acme/api', sidecar: true, port: 3000 },
      site: { image: 'acme/site', port: 8080, env: { MODE: 'prod' } },
    });
    expect(result.warnings).toEqual([
      "Compose service 'site' reads env_file 'missing.env', which is not in the deployed source. Set those variables in the console instead.",
    ]);
  });

  it('resolves build contexts relative to the Compose file and keeps list build args', async () => {
    const compose = `
services:
  api:
    build:
      context: ./api
      dockerfile: Dockerfile.prod
      target: prod
      args: [VERSION=2, EMPTY]
`;
    const result = Either.getOrThrow(await readCompose(compose, {}, 'deploy/compose.yaml'));

    expect(result.containers.api).toEqual({
      build: { context: 'deploy/api', dockerfile: 'Dockerfile.prod', target: 'prod', args: { VERSION: '2' } },
    });
  });

  it('falls back to the first service publishing a port', async () => {
    const compose = `
services:
  cache:
    image: redis
  web:
    image: nginx
    ports: [{ target: 80, published: 8080 }]
`;
    const result = Either.getOrThrow(await readCompose(compose));

    expect(result.publicService).toBe('web');
    expect(result.containers.web).toEqual({ image: 'nginx', port: 80 });
  });

  it('warns about memory outside the supported range', async () => {
    const compose = `
services:
  web:
    image: nginx
    ports: ["80"]
    mem_limit: 8g
`;
    const result = Either.getOrThrow(await readCompose(compose));

    expect(result.containers.web).toEqual({ image: 'nginx', port: 80 });
    expect(result.warnings).toEqual([
      "Compose service 'web' asks for 8192 MB of memory, outside the supported 128 to 3009 MB. The default is used instead.",
    ]);
  });

  it.each([
    ['services:\n  cache:\n    image: redis\n', 'has no service that builds from source or publishes a port'],
    ['services: {}\n', 'declares no services'],
    ['services: [\n', 'is not valid YAML'],
    ['services:\n  web:\n    ports: ["80"]\n', "Compose service 'web' has neither an image nor a build"],
  ])('fails clearly for %j', async (compose, message) => {
    const result = await readCompose(compose);

    expect(JSON.stringify(result)).toContain(message);
  });

  it('fails when the file is missing or outside the project', async () => {
    expect(JSON.stringify(await run(readComposeContainers('compose.yaml', '/project'), {}))).toContain(
      "Compose file 'compose.yaml' could not be read."
    );
    expect(JSON.stringify(await run(readComposeContainers('../compose.yaml', '/project'), {}))).toContain(
      'is outside the project'
    );
  });
});

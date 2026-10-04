import { FileSystem, Path } from '@effect/platform';
import { NodeContext } from '@effect/platform-node';
import { Effect, Either, Layer } from 'effect';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  containerEntrypointPath,
  dockerFunctionContainerName,
  normalizeContainers,
  readComposeContainers,
  splitCommandWords,
} from './containers';
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
    expect(() => splitCommandWords('echo "open')).not.toThrow('open');
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

  it.each([
    ['Web', 'web'],
    ['localhost', 'app'],
    ['-web', 'web'],
    ['a'.repeat(64), 'a'.repeat(63)],
    ['web.app', 'web-app'],
    ['1234', 'app-1234'],
    ['0web', 'app-0web'],
    ['_web', 'web'],
  ])('refuses the name %j and suggests %j', async (name, suggestion) => {
    const result = await normalize({ [name]: { image: 'nginx' } });

    expect(Either.getLeft(result).pipe((left) => left._tag === 'Some' && left.value.message)).toBe(
      `Container name '${name}' is invalid. The name is also the hostname the function reaches the container by, so it must be 1 to 63 lowercase letters, digits, '-' or '_', starting with a letter, and not 'localhost'. Try '${suggestion}'.`
    );
  });

  it.each(['a', 'web-1', 'my_app', `a${'0'.repeat(62)}`])('accepts the name %j', async (name) => {
    expect(Either.isRight(await normalize({ [name]: { image: 'nginx' } }))).toBe(true);
  });

  it('normalizes a numeric user to a string', async () => {
    const result = Either.getOrThrow(await normalize({ web: { image: 'nginx', user: 1000 } }));

    expect(result.entrypoints[0].container?.user).toBe('1000');
  });

  it.each([
    ['a fractional memory', { memory: 512.5 }, 'asks for 512.5 MB of memory. Use a whole number from 128 to 3009.'],
    ['too much memory', { memory: 4096 }, 'asks for 4096 MB of memory'],
    ['a fractional port', { port: 80.5 }, 'listens on port 80.5. Use a whole number from 1 to 65535.'],
    ['a relative working_dir', { working_dir: 'app' }, "sets working_dir 'app', which must be an absolute path"],
    ['an empty user', { user: '' }, 'sets an empty or overlong user'],
    ['a negative numeric user', { user: -1 }, 'sets user -1. A numeric user must be a non-negative whole number.'],
    ['an image with whitespace', { image: 'nginx latest' }, 'has an invalid image reference'],
    [
      'too many environment variables',
      { env: Object.fromEntries(Array.from({ length: 101 }, (_, index) => [`V${index}`, 'x'])) },
      'sets 101 environment variables. At most 100 are allowed.',
    ],
    ['an environment name with =', { env: { 'A=B': 'x' } }, "sets an environment variable named 'A=B'"],
    [
      'an overlong environment value',
      { env: { BIG: 'x'.repeat(65_537) } },
      "sets environment variable 'BIG' to a value longer than 65536 characters.",
    ],
  ])('refuses a container with %s', async (_label, overrides, message) => {
    const result = await normalize({ web: { image: 'nginx', ...overrides } });

    expect(Either.getLeft(result).pipe((left) => left._tag === 'Some' && left.value.message)).toContain(
      `Container 'web' ${message}`
    );
  });

  it('never echoes an environment value in an error', async () => {
    const result = await normalize({ web: { image: 'nginx', env: { TOKEN: `secret-${'x'.repeat(65_536)}` } } });

    expect(JSON.stringify(result)).not.toContain('secret-');
  });

  it('refuses an absolute Dockerfile path even inside a relative context', async () => {
    const result = await normalize(
      { app: { build: { context: '.', dockerfile: '/etc/passwd' } } },
      { '/project/etc/passwd': 'FROM scratch' }
    );

    expect(JSON.stringify(result)).toContain('outside the project');
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
    x-gigadrive: { public: true }
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

  it('reads long-syntax ports whose values are strings after interpolation, skipping UDP', async () => {
    const compose = `
services:
  cache:
    image: redis
  web:
    image: nginx
    x-gigadrive: { public: true }
    ports:
      - { target: 53, published: "5353", protocol: udp }
      - { target: "\${WEB_PORT:-3000}", published: "8080" }
`;
    const result = Either.getOrThrow(await readCompose(compose));

    expect(result.publicService).toBe('web');
    expect(result.containers.web).toEqual({ image: 'nginx', port: 3000 });
  });

  it('warns about memory outside the supported range', async () => {
    const compose = `
services:
  web:
    build: .
    ports: ["80"]
    mem_limit: 8g
`;
    const result = Either.getOrThrow(await readCompose(compose));

    expect(result.containers.web).toEqual({ build: { context: '.' }, port: 80 });
    expect(result.warnings).toEqual([
      "Compose service 'web' asks for 8192 MB of memory, outside the supported 128 to 3009 MB. The default is used instead.",
    ]);
  });

  it.each([
    ['services:\n  cache:\n    image: redis\n', 'has no service that builds from source'],
    ['services: {}\n', 'declares no services'],
    ['services: [\n', "Compose file 'docker-compose.yml' is not valid YAML (line 2, column 1)."],
    [
      'services:\n  web:\n    ports: ["80"]\n    x-gigadrive: { public: true }\n',
      "Compose service 'web' has neither an image nor a build",
    ],
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

describe('dockerFunctionContainerName', () => {
  it.each([
    ['Dockerfile', 'app'],
    ['Dockerfile.worker', 'worker'],
    ['worker.Dockerfile', 'worker'],
    ['services/api/Dockerfile', 'api'],
    ['services/api/Dockerfile.prod', 'api-prod'],
    ['docker/Web.Dockerfile', 'docker-web'],
    ['My App/Dockerfile', 'my-app'],
    ['_internal/Dockerfile', 'internal'],
    ['localhost/Dockerfile', 'app'],
    ['api/Containerfile', 'api-containerfile'],
    ['services/1/Dockerfile', 'app-1'],
    ['2024/Dockerfile.prod', 'app-2024-prod'],
  ])('names %s %s', (file, name) => {
    expect(dockerFunctionContainerName(file)).toBe(name);
  });
});

describe('readComposeContainers public service', () => {
  it('uses the only service that builds from source', async () => {
    const compose = 'services:\n  db:\n    image: postgres\n    ports: ["5432"]\n  web:\n    build: .\n';
    expect(Either.getOrThrow(await readCompose(compose)).publicService).toBe('web');
  });

  it('prefers the service marked public over the one that builds', async () => {
    const compose =
      'services:\n  worker:\n    build: ./worker\n  site:\n    image: acme/site\n    x-gigadrive: { public: true }\n';
    const result = Either.getOrThrow(await readCompose(compose));

    expect(result.publicService).toBe('site');
    expect(result.containers.worker).toEqual({ build: { context: 'worker' }, sidecar: true });
  });

  it('does not count a build service marked as a sidecar', async () => {
    const compose =
      'services:\n  proxy:\n    build: ./proxy\n    x-gigadrive: { sidecar: true }\n  web:\n    build: .\n';
    expect(Either.getOrThrow(await readCompose(compose)).publicService).toBe('web');
  });

  it.each([
    [
      'two services marked public',
      'services:\n  a:\n    image: x\n    x-gigadrive: { public: true }\n  b:\n    image: y\n    x-gigadrive: { public: true }\n',
      "Compose file 'docker-compose.yml' marks 'a', 'b' as public. One service serves HTTP: keep 'x-gigadrive: { public: true }' on that one only.",
    ],
    [
      'no build service and no marker, even with published ports',
      'services:\n  cache:\n    image: redis\n  web:\n    image: nginx\n    ports: ["80:80"]\n',
      "Compose file 'docker-compose.yml' has no service that builds from source, so it is unclear which service serves HTTP. Mark it with 'x-gigadrive: { public: true }'.",
    ],
    [
      'two build services and no marker',
      'services:\n  web:\n    build: .\n  worker:\n    build: ./worker\n',
      "Compose file 'docker-compose.yml' builds 'web', 'worker' from source, so it is unclear which service serves HTTP. Mark it with 'x-gigadrive: { public: true }'.",
    ],
  ])('fails for %s', async (_label, compose, message) => {
    const result = await readCompose(compose);

    expect(Either.getLeft(result).pipe((left) => left._tag === 'Some' && left.value.message)).toBe(message);
  });
});

describe('readComposeContainers translation', () => {
  /** Reads one public image service with the given extra YAML lines, indented under it. */
  const readService = async (lines: string, files: Record<string, string> = {}) =>
    readCompose(
      `services:\n  web:\n    image: nginx\n    x-gigadrive: { public: true }\n${lines
        .split('\n')
        .map((line) => `    ${line}`)
        .join('\n')}\n`,
      files
    );

  const message = (result: Awaited<ReturnType<typeof readService>>) =>
    Either.getLeft(result).pipe((left) => (left._tag === 'Some' ? left.value.message : undefined));

  it('refuses build.dockerfile_inline instead of building ./Dockerfile', async () => {
    const compose = 'services:\n  web:\n    build:\n      dockerfile_inline: |\n        FROM alpine\n';
    expect(message(await readCompose(compose, { '/project/Dockerfile': 'FROM scratch' }))).toBe(
      "Compose service 'web' uses build.dockerfile_inline, which is not supported. Commit the Dockerfile and point build.dockerfile at it."
    );
  });

  it.each([
    ['${A:-${B:-fallback}}', {}, 'fallback'],
    ['${A:-${B:-fallback}}', { B: 'b' }, 'b'],
    ['${A:-${B:-fallback}}', { A: 'a', B: 'b' }, 'a'],
    ['${A:-}', { A: '' }, ''],
    ['${A-default}', { A: '' }, ''],
    ['${A:-default}', { A: '' }, 'default'],
    ['${A:+on}', { A: 'x' }, 'on'],
    ['${A:+on}', { A: '' }, ''],
    ['${A+on}', { A: '' }, 'on'],
    ['${A+on}', {}, ''],
    ['${A:+${B}-suffix}', { A: '1', B: 'b' }, 'b-suffix'],
    ['${A:?must be set}', { A: 'ok' }, 'ok'],
    ['${A?must be set}', { A: '' }, ''],
    ['cost: $$5 and $ alone and $1', {}, 'cost: $5 and $ alone and $1'],
    ['{${A:-a}}', {}, '{a}'],
  ])('interpolates %s with %j', async (expression, variables, expected) => {
    const dotEnv = Object.entries(variables)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    const result = Either.getOrThrow(
      await readService(`environment:\n  VALUE: '${expression}'`, { '/project/.env': dotEnv })
    );

    expect(result.containers.web.env).toEqual({ VALUE: expected });
    expect(result.warnings).toEqual([]);
  });

  it.each([
    [
      '${DB_PASSWORD:?set the database password}',
      '',
      "Compose service 'web' needs variable 'DB_PASSWORD' in environment.VALUE, which is not set: set the database password. Compose variables come only from the .env file next to the Compose file.",
    ],
    [
      '${DB_PASSWORD:?}',
      'DB_PASSWORD=',
      "Compose service 'web' needs variable 'DB_PASSWORD' in environment.VALUE, which is empty. Compose variables come only from the .env file next to the Compose file.",
    ],
    [
      '${DB_PASSWORD?needs ${HINT:-a hint}}',
      '',
      "Compose service 'web' needs variable 'DB_PASSWORD' in environment.VALUE, which is not set: needs a hint. Compose variables come only from the .env file next to the Compose file.",
    ],
    [
      '${unterminated',
      '',
      "Compose service 'web' has an invalid variable reference in environment.VALUE. Write '$$' for a literal '$'.",
    ],
    ['${1BAD}', '', "Compose service 'web' has an invalid variable reference in environment.VALUE."],
  ])('fails for %s', async (expression, dotEnv, expected) => {
    const result = await readService(`environment:\n  VALUE: '${expression}'`, { '/project/.env': dotEnv });

    expect(message(result)).toContain(expected);
  });

  it('skips interpolation of services that are not deployed', async () => {
    const compose =
      "services:\n  web:\n    build: .\n  tools:\n    image: '${REQUIRED:?only for tools}'\n    profiles: [tools]\n";
    expect(Either.isRight(await readCompose(compose))).toBe(true);
  });

  it('reads .env values the way Compose does', async () => {
    const dotEnv = [
      "SINGLE='abc' # trailing comment",
      'DOUBLE="a\\tb\\n\\"c\\" \\\\ d" # comment',
      'export EXPORTED=yes',
      'UNQUOTED=value # comment',
      'HASH=#not-a-comment',
      'SPACED = padded value ',
      'EMPTY=',
      'MULTI="line one',
      'line two"',
      '# COMMENTED=1',
      'not a variable line',
    ].join('\n');
    const result = Either.getOrThrow(
      await readService(
        [
          'environment:',
          '  SINGLE: $SINGLE',
          '  DOUBLE: $DOUBLE',
          '  EXPORTED: $EXPORTED',
          '  UNQUOTED: $UNQUOTED',
          '  HASH: $HASH',
          '  SPACED: $SPACED',
          '  EMPTY: x${EMPTY}x',
          '  MULTI: $MULTI',
        ].join('\n'),
        { '/project/.env': dotEnv }
      )
    );

    expect(result.containers.web.env).toEqual({
      SINGLE: 'abc',
      DOUBLE: 'a\tb\n"c" \\ d',
      EXPORTED: 'yes',
      UNQUOTED: 'value',
      HASH: '#not-a-comment',
      SPACED: 'padded value',
      EMPTY: 'xx',
      MULTI: 'line one\nline two',
    });
    expect(result.warnings).toEqual([]);
  });

  it.each([
    ['512m', 512],
    ['512M', 512],
    ['512MiB', 512],
    ['512 MB', 512],
    ['512mb', 512],
    ['1GiB', 1024],
    ['1g', 1024],
    ['1.5g', 1536],
    ['262144k', 256],
    ['536870912', 512],
    ['536870912b', 512],
  ])('reads the memory limit %j as %i MB', async (limit, megabytes) => {
    const result = Either.getOrThrow(await readService(`mem_limit: '${limit}'`));

    expect(result.containers.web.memory).toBe(megabytes);
    expect(result.warnings).toEqual([]);
  });

  it('reads a numeric memory limit as bytes and prefers deploy limits', async () => {
    const result = Either.getOrThrow(
      await readService('mem_limit: 1073741824\ndeploy:\n  resources:\n    limits:\n      memory: 256M')
    );

    expect(result.containers.web.memory).toBe(256);
  });

  it('warns about a memory limit it cannot read', async () => {
    const result = Either.getOrThrow(await readService("mem_limit: 'lots'"));

    expect(result.containers.web.memory).toBeUndefined();
    expect(result.warnings).toEqual([
      'Compose service \'web\' sets the memory limit "lots", which is not a size Docker accepts. The default is used instead.',
    ]);
  });

  it('treats a zero memory limit as no limit', async () => {
    const result = Either.getOrThrow(await readService('mem_limit: 0'));

    expect(result.containers.web.memory).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });

  it('reads long-syntax env_file entries', async () => {
    const result = Either.getOrThrow(
      await readService(
        'env_file:\n  - path: ./base.env\n  - path: ./local.env\n    required: false\n  - path: ./other.env',
        { '/project/base.env': 'A=1\nB=2\n' }
      )
    );

    expect(result.containers.web.env).toEqual({ A: '1', B: '2' });
    expect(result.warnings).toEqual([
      "Compose service 'web' reads env_file './other.env', which is not in the deployed source. Set those variables in the console instead.",
    ]);
  });

  it('fails for a missing env_file marked required', async () => {
    const result = await readService('env_file:\n  - path: ./secrets.env\n    required: true');

    expect(message(result)).toBe(
      "Compose service 'web' requires env_file './secrets.env', which is not in the deployed source. Commit it, mark it 'required: false', or set those variables in the console."
    );
  });

  it('does not read an absolute env_file as a project path', async () => {
    const result = Either.getOrThrow(
      await readService('env_file: /etc/app.env', { '/project/etc/app.env': 'LEAK=1\n' })
    );

    expect(result.containers.web.env).toBeUndefined();
    expect(result.warnings).toEqual([
      "Compose service 'web' reads env_file '/etc/app.env', which is not in the deployed source. Set those variables in the console instead.",
    ]);
  });

  it('warns about extends and about a default override file next to the Compose file', async () => {
    const result = Either.getOrThrow(
      await readService('extends:\n  file: common.yml\n  service: base', {
        '/project/docker-compose.override.yml': 'services: {}\n',
        '/project/compose.override.yaml': 'services: {}\n',
      })
    );

    expect(result.warnings).toEqual([
      "Compose file 'docker-compose.yml' has the override file 'compose.override.yaml' next to it, which is not merged. Move its settings into 'docker-compose.yml' or gigadrive.yaml.",
      "Compose file 'docker-compose.yml' has the override file 'docker-compose.override.yml' next to it, which is not merged. Move its settings into 'docker-compose.yml' or gigadrive.yaml.",
      "Compose service 'web' uses 'extends', which is not supported. The service is deployed as written, without the settings it would inherit.",
    ]);
  });

  it('does not look for override files next to a custom-named Compose file', async () => {
    const result = Either.getOrThrow(
      await readCompose(
        'services:\n  web:\n    build: .\n',
        { '/project/deploy/compose.override.yaml': 'services: {}\n' },
        'deploy/stack.yaml'
      )
    );

    expect(result.warnings).toEqual([]);
  });

  it('normalizes a numeric user to a string', async () => {
    expect(Either.getOrThrow(await readService('user: 1000')).containers.web.user).toBe('1000');
  });

  it.each([
    ['working_dir: app', "Container 'web' sets working_dir 'app', which must be an absolute path"],
    ["user: ''", "Container 'web' sets an empty or overlong user"],
    ["user: '${RUN_AS}'", "Container 'web' sets an empty or overlong user"],
  ])('fails in normalizeContainers for %j, as gigadrive.yaml would', async (line, expected) => {
    const imported = Either.getOrThrow(await readService(line));
    const result = await normalize(imported.containers);

    expect(message(result)).toContain(expected);
  });

  it.each([
    ['Web', 'web'],
    ['api.v1', 'api-v1'],
    ['1db', 'app-1db'],
  ])('explains why the service name %j is refused and suggests %j', async (name, suggestion) => {
    const result = await readCompose(`services:\n  ${name}:\n    build: .\n`);

    expect(message(result)).toBe(
      `Compose service '${name}' cannot be imported under that name. The service name becomes the hostname the function reaches it by, so it must be 1 to 63 lowercase letters, digits, '-' or '_', starting with a letter, and not 'localhost'. Rename the service to '${suggestion}' in 'docker-compose.yml'.`
    );
  });

  it('does not echo the file contents when the YAML is invalid', async () => {
    const result = await readCompose('services:\n  web:\n    image: nginx\n  password: "hunter2\n');

    expect(JSON.stringify(result)).not.toContain('hunter2');
    expect(message(result)).toMatch(/^Compose file 'docker-compose.yml' is not valid YAML/);
  });
});

describe('symbolic links', () => {
  let projectFolder: string;
  let outside: string;

  beforeEach(() => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'gigadrive-containers-')));
    projectFolder = join(root, 'project');
    outside = join(root, 'outside');
    mkdirSync(projectFolder);
    mkdirSync(outside);
    writeFileSync(join(outside, 'secret.env'), 'AWS_SECRET_ACCESS_KEY=leaked\n');
    writeFileSync(join(outside, 'Dockerfile'), 'FROM scratch\n');
  });

  afterEach(() => {
    rmSync(join(projectFolder, '..'), { recursive: true, force: true });
  });

  const runNode = <A, E>(effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>) =>
    Effect.runPromise(Effect.either(effect.pipe(Effect.provide(NodeContext.layer))));

  const write = (file: string, content: string) => {
    mkdirSync(join(projectFolder, file, '..'), { recursive: true });
    writeFileSync(join(projectFolder, file), content);
  };

  const failure = (result: Either.Either<unknown, { message: string }>) =>
    Either.getLeft(result).pipe((left) => (left._tag === 'Some' ? left.value.message : undefined));

  it('refuses an env_file that links outside the project', async () => {
    write('compose.yaml', 'services:\n  web:\n    build: .\n    env_file: app.env\n');
    write('Dockerfile', 'FROM scratch\n');
    symlinkSync(join(outside, 'secret.env'), join(projectFolder, 'app.env'));

    const result = await runNode(readComposeContainers('compose.yaml', projectFolder));

    expect(failure(result)).toBe(
      "The env_file 'app.env' of Compose service 'web' leads through a symbolic link to a location outside the project. Only files inside the project can be deployed."
    );
    expect(JSON.stringify(result)).not.toContain('leaked');
  });

  it('refuses an env_file reached through a directory that links outside the project', async () => {
    write('compose.yaml', 'services:\n  web:\n    build: .\n    env_file: config/secret.env\n');
    write('Dockerfile', 'FROM scratch\n');
    symlinkSync(outside, join(projectFolder, 'config'));

    const result = await runNode(readComposeContainers('compose.yaml', projectFolder));

    expect(failure(result)).toContain('leads through a symbolic link to a location outside the project');
  });

  it('refuses a .env file that links outside the project', async () => {
    write('compose.yaml', 'services:\n  web:\n    build: .\n');
    symlinkSync(join(outside, 'secret.env'), join(projectFolder, '.env'));

    const result = await runNode(readComposeContainers('compose.yaml', projectFolder));

    expect(failure(result)).toBe(
      "The .env file next to 'compose.yaml' leads through a symbolic link to a location outside the project. Only files inside the project can be deployed."
    );
  });

  it('refuses a Compose file that links outside the project', async () => {
    writeFileSync(join(outside, 'compose.yaml'), 'services:\n  web:\n    build: .\n');
    symlinkSync(join(outside, 'compose.yaml'), join(projectFolder, 'compose.yaml'));

    const result = await runNode(readComposeContainers('compose.yaml', projectFolder));

    expect(failure(result)).toContain("Compose file 'compose.yaml' leads through a symbolic link");
  });

  it('refuses a Dockerfile that links outside the project', async () => {
    symlinkSync(join(outside, 'Dockerfile'), join(projectFolder, 'Dockerfile'));

    const result = await runNode(normalizeContainers({ app: { build: '.' } }, projectFolder));

    expect(failure(result)).toBe(
      "The Dockerfile 'Dockerfile' of container 'app' leads through a symbolic link to a location outside the project. Only files inside the project can be deployed."
    );
  });

  it('refuses a build context that links outside the project', async () => {
    symlinkSync(outside, join(projectFolder, 'api'));

    const result = await runNode(normalizeContainers({ api: { build: 'api' } }, projectFolder));

    expect(failure(result)).toContain("The build context 'api' of container 'api' leads through a symbolic link");
  });

  it('follows links that stay inside the project, and treats a dangling link as missing', async () => {
    write('config/app.env', 'MODE=prod\n');
    write('docker/Dockerfile', 'FROM scratch\n');
    write('compose.yaml', 'services:\n  web:\n    build:\n      context: .\n    env_file: [app.env, gone.env]\n');
    symlinkSync(join(projectFolder, 'config/app.env'), join(projectFolder, 'app.env'));
    symlinkSync(join(projectFolder, 'docker/Dockerfile'), join(projectFolder, 'Dockerfile'));
    symlinkSync(join(outside, 'does-not-exist.env'), join(projectFolder, 'gone.env'));

    const imported = Either.getOrThrow(await runNode(readComposeContainers('compose.yaml', projectFolder)));
    expect(imported.containers.web.env).toEqual({ MODE: 'prod' });
    expect(imported.warnings).toEqual([
      "Compose service 'web' reads env_file 'gone.env', which is not in the deployed source. Set those variables in the console instead.",
    ]);

    const normalized = Either.getOrThrow(await runNode(normalizeContainers(imported.containers, projectFolder)));
    expect(normalized.entrypoints[0].container?.source).toEqual({
      type: 'dockerfile',
      context: '.',
      dockerfile: 'Dockerfile',
    });
  });

  it('works when the project folder itself is reached through a link', async () => {
    write('Dockerfile', 'FROM scratch\n');
    const alias = join(projectFolder, '..', 'alias');
    symlinkSync(projectFolder, alias);

    expect(Either.isRight(await runNode(normalizeContainers({ app: { build: '.' } }, alias)))).toBe(true);
  });
});

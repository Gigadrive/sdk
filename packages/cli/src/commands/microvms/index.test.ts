import { NodeContext } from '@effect/platform-node';
import { GigadriveClient, type MicroVmInfo } from '@gigadrive/sdk';
import { Effect, Either, Layer, Logger, LogLevel, Option } from 'effect';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionIo } from '../../lib/microvm-session';
import { ApiClientService, toApiRequestError } from '../../services/api-client';
import { ProjectLinkService } from '../../services/project-link';
import {
  copyFiles,
  createImage,
  createInput,
  createMicroVm,
  errorMessage,
  execInMicroVm,
  extendMicroVm,
  listMicroVms,
  parseDuration,
  removeImage,
  updateMicroVmNetwork,
  type CreateFlags,
  type ExecFlags,
} from './index';

// ---------------------------------------------------------------------------
// Fixtures: a real SDK client on a mocked fetch
// ---------------------------------------------------------------------------

const vmInfo = (overrides: Partial<MicroVmInfo> = {}): MicroVmInfo => ({
  id: 'vm-1',
  slug: 'abc',
  applicationId: 'app-1',
  organizationId: 'org-1',
  status: 'running',
  image: { id: 'img', name: 'node22' },
  vcpus: 1,
  memoryMb: 2048,
  diskMb: 10240,
  region: 'fr-par',
  ports: [],
  network: { egress: 'allow' },
  metadata: {},
  timeoutMs: 300_000,
  expiresAt: '2026-10-23T12:05:00.000Z',
  createdAt: '2026-10-23T12:00:00.000Z',
  startedAt: '2026-10-23T12:00:01.000Z',
  stoppedAt: null,
  stopReason: null,
  ...overrides,
});

const commandInfo = (overrides: Record<string, unknown> = {}) => ({
  id: 'cmd_1',
  cmd: 'ls',
  args: [],
  cwd: '/workspace',
  user: 'user',
  status: 'running',
  exitCode: null,
  signal: null,
  timedOut: false,
  pid: 7,
  pty: false,
  startedAt: '2026-10-23T12:00:00.000Z',
  finishedAt: null,
  ...overrides,
});

const json = (body: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const b64 = (text: string) => Buffer.from(text).toString('base64');

const sse = (...events: Array<[string, unknown]>) =>
  new Response(events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(''), {
    headers: { 'Content-Type': 'text/event-stream' },
  });

type Route = (url: URL, init: RequestInit | undefined) => Response | Promise<Response> | undefined;

/** A client whose fetch answers from `routes` (first match wins) and records every request. */
const fakeApi = (...routes: Route[]) => {
  const calls: Array<{ method: string; url: URL; body: unknown }> = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const url = new URL(String(input));
    let body: unknown = init?.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body) as unknown;
      } catch {
        // A raw text body; keep it as is.
      }
    }
    calls.push({ method: init?.method ?? 'GET', url, body });
    for (const route of routes) {
      const response = await route(url, init);
      if (response) return response;
    }
    return json({ error: `No route for ${init?.method ?? 'GET'} ${url.pathname}` }, 404);
  });
  const client = new GigadriveClient({ bearerToken: 'token', baseUrl: 'https://api.test', fetch });
  const layer = Layer.mergeAll(
    Layer.succeed(ApiClientService, {
      getClient: Effect.succeed(client),
      request: <A>(run: (client: GigadriveClient) => Promise<A>) =>
        Effect.tryPromise({ try: () => run(client), catch: toApiRequestError }),
    } as unknown as ApiClientService),
    Layer.succeed(ProjectLinkService, {
      load: () => Effect.succeed(Option.some({ applicationId: 'app-linked' })),
    } as unknown as ProjectLinkService),
    NodeContext.layer,
    Logger.minimumLogLevel(LogLevel.None)
  );
  return { calls, fetch, layer };
};

const route =
  (method: string, path: string | RegExp, respond: (url: URL, init: RequestInit | undefined) => Response): Route =>
  (url, init) =>
    (init?.method ?? 'GET') === method && (typeof path === 'string' ? url.pathname === path : path.test(url.pathname))
      ? respond(url, init)
      : undefined;

const run = <A, E>(
  effect: Effect.Effect<A, E, ApiClientService | ProjectLinkService | NodeContext.NodeContext>,
  layer: Layer.Layer<ApiClientService | ProjectLinkService | NodeContext.NodeContext>
) => Effect.runPromise(Effect.either(effect.pipe(Effect.provide(layer))));

const createFlags = (overrides: Partial<CreateFlags> = {}): CreateFlags => ({
  app: Option.none(),
  image: Option.none(),
  vcpus: Option.none(),
  memory: Option.none(),
  disk: Option.none(),
  timeout: Option.none(),
  ports: [],
  env: [],
  metadata: [],
  denyEgress: false,
  privatePreviews: false,
  allowEgress: [],
  pauseOnTimeout: false,
  region: Option.none(),
  json: true,
  ...overrides,
});

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

describe('parseDuration', () => {
  it('accepts unit strings and refuses bare numbers and junk', () => {
    expect(Effect.runSync(parseDuration('--timeout', '10m'))).toBe(600_000);
    expect(Effect.runSync(parseDuration('--timeout', '90s'))).toBe(90_000);
    for (const bad of ['600', '1.5', 'soon', '-5m']) {
      const result = Effect.runSync(Effect.either(parseDuration('--timeout', bad)));
      expect(Either.isLeft(result) && result.left._tag).toBe('InvalidMicroVmOptionsError');
    }
  });
});

describe('errorMessage', () => {
  const apiError = (code: string) => ({ _tag: 'ApiRequestError', message: 'Refused.', code });

  it('explains microVM error codes', () => {
    expect(errorMessage('x', apiError('microvm_not_running'))).toContain('gigadrive microvms create');
    expect(errorMessage('x', apiError('microvm_busy'))).toContain('try again');
    expect(errorMessage('x', apiError('microvm_unreachable'))).toContain('gigadrive microvms get');
    expect(errorMessage('x', apiError('image_not_ready'))).toContain('gigadrive microvms images ls');
    expect(errorMessage('x', apiError('plan_limit_exceeded'))).toContain('https://console.gigadrive.de');
    expect(errorMessage('list microVMs', apiError('other'))).toBe('Failed to list microVMs: Refused.');
  });
});

describe('createInput', () => {
  it('maps every flag onto the API body', async () => {
    const { layer } = fakeApi();
    const result = await run(
      createInput(
        createFlags({
          app: Option.some('app-x'),
          image: Option.some('python3.13'),
          vcpus: Option.some('4'),
          memory: Option.some(4096),
          disk: Option.some(20_480),
          timeout: Option.some('1h'),
          ports: [3000, 8080],
          env: ['A=1', 'B=two=2'],
          metadata: ['team=ai'],
          denyEgress: true,
          region: Option.some('fr-par'),
        })
      ),
      layer
    );

    expect(result).toEqual(
      Either.right({
        applicationId: 'app-x',
        image: 'python3.13',
        vcpus: 4,
        memoryMb: 4096,
        diskMb: 20_480,
        timeoutMs: 3_600_000,
        ports: [3000, 8080],
        env: { A: '1', B: 'two=2' },
        metadata: { team: 'ai' },
        network: { egress: 'deny' },
        region: 'fr-par',
      })
    );
  });

  it('asks for private previews, alone or with blocked egress', async () => {
    const { layer } = fakeApi();

    await expect(run(createInput(createFlags({ privatePreviews: true })), layer)).resolves.toEqual(
      Either.right({ applicationId: 'app-linked', network: { egress: 'allow', previews: 'private' } })
    );
    await expect(run(createInput(createFlags({ privatePreviews: true, denyEgress: true })), layer)).resolves.toEqual(
      Either.right({ applicationId: 'app-linked', network: { egress: 'deny', previews: 'private' } })
    );
  });

  it('limits egress to the listed destinations, and refuses that together with --deny-egress', async () => {
    const { layer } = fakeApi();

    await expect(
      run(createInput(createFlags({ allowEgress: ['140.82.112.0/20', 'api.openai.com', '*.github.com'] })), layer)
    ).resolves.toEqual(
      Either.right({
        applicationId: 'app-linked',
        network: { egress: 'allow', allow: ['140.82.112.0/20', 'api.openai.com', '*.github.com'] },
      })
    );
    for (const flags of [
      createFlags({ allowEgress: ['140.82.112.0/20'], denyEgress: true }),
      createFlags({ allowEgress: ['api.openai.com'], denyEgress: true }),
      createFlags({ allowEgress: ['https://api.openai.com'] }),
      createFlags({ allowEgress: ['api.openai.com:443'] }),
      createFlags({ allowEgress: ['*.com'] }),
      createFlags({ allowEgress: ['localhost'] }),
      createFlags({ allowEgress: ['140.82.112.0'] }),
      createFlags({ allowEgress: Array.from({ length: 33 }, (_, i) => `203.0.113.${i}/32`) }),
    ]) {
      expect(Either.isLeft(await run(createInput(flags), layer))).toBe(true);
    }
  });

  it('asks to pause at the timeout with --pause-on-timeout', async () => {
    const { layer } = fakeApi();

    await expect(run(createInput(createFlags({ pauseOnTimeout: true })), layer)).resolves.toEqual(
      Either.right({ applicationId: 'app-linked', onTimeout: 'pause' })
    );
  });

  it('defaults to the linked application and sends nothing else', async () => {
    const { layer } = fakeApi();

    await expect(run(createInput(createFlags()), layer)).resolves.toEqual(
      Either.right({ applicationId: 'app-linked' })
    );
  });

  it('refuses malformed env, metadata, ports and timeouts', async () => {
    const { layer } = fakeApi();
    for (const flags of [
      createFlags({ env: ['NOPE'] }),
      createFlags({ metadata: ['=x'] }),
      createFlags({ ports: [0] }),
      createFlags({ ports: [70_000] }),
      createFlags({ timeout: Option.some('5') }),
      createFlags({ timeout: Option.some('25h') }),
    ]) {
      const result = await run(createInput(flags), layer);
      expect(Either.isLeft(result) && result.left._tag).toBe('InvalidMicroVmOptionsError');
    }
  });
});

// ---------------------------------------------------------------------------
// create / ls / extend
// ---------------------------------------------------------------------------

describe('createMicroVm', () => {
  it('creates and prints JSON', async () => {
    const api = fakeApi(route('POST', '/microvms', () => json(vmInfo(), 201)));

    const result = await run(createMicroVm(createFlags({ image: Option.some('bun1') })), api.layer);

    expect(Either.isRight(result)).toBe(true);
    expect(api.calls[0]?.body).toEqual({ applicationId: 'app-linked', image: 'bun1' });
    expect(JSON.parse(String(logSpy.mock.calls[0]?.[0]))).toMatchObject({ id: 'vm-1' });
  });

  it('prints a summary with next steps', async () => {
    const api = fakeApi(route('POST', '/microvms', () => json(vmInfo(), 201)));

    await run(createMicroVm(createFlags({ json: false })), api.layer);

    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).toContain('ID:          vm-1');
    expect(output).toContain('gigadrive microvms exec vm-1 -- <command>');
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('Creating a microVM from node22');
  });

  it('surfaces quota errors as ApiRequestError', async () => {
    const api = fakeApi(
      route('POST', '/microvms', () => json({ error: 'Limit reached', code: 'quota_exceeded' }, 402))
    );

    const result = await run(createMicroVm(createFlags()), api.layer);

    expect(Either.isLeft(result) && result.left).toMatchObject({ _tag: 'ApiRequestError', code: 'quota_exceeded' });
  });
});

describe('listMicroVms', () => {
  const page = (url: URL) =>
    url.searchParams.get('cursor')
      ? json({ data: [vmInfo({ id: 'vm-3' })], pagination: {} })
      : json({
          data: [vmInfo({ id: 'vm-1' }), vmInfo({ id: 'vm-2', status: 'stopped' })],
          pagination: { nextCursor: 'next' },
        });

  it('hides stopped microVMs unless --all, across pages', async () => {
    const api = fakeApi(route('GET', '/microvms', page));

    await run(
      listMicroVms({ app: Option.none(), status: Option.none(), all: false, limit: 50, json: true }),
      api.layer
    );
    const shown = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as MicroVmInfo[];

    expect(shown.map((vm) => vm.id)).toEqual(['vm-1', 'vm-3']);
    expect(api.calls[0]?.url.searchParams.get('applicationId')).toBe('app-linked');
  });

  it('shows everything with --all and stops at --limit', async () => {
    const api = fakeApi(route('GET', '/microvms', page));

    await run(
      listMicroVms({ app: Option.some('app-2'), status: Option.none(), all: true, limit: 2, json: true }),
      api.layer
    );
    const shown = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as MicroVmInfo[];

    expect(shown.map((vm) => vm.id)).toEqual(['vm-1', 'vm-2']);
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]?.url.searchParams.get('applicationId')).toBe('app-2');
  });

  it('passes --status to the API and prints a table', async () => {
    const api = fakeApi(
      route('GET', '/microvms', () => json({ data: [vmInfo({ status: 'failed' })], pagination: {} }))
    );

    await run(
      listMicroVms({ app: Option.none(), status: Option.some('failed'), all: false, limit: 50, json: false }),
      api.layer
    );

    expect(api.calls[0]?.url.searchParams.get('status')).toBe('failed');
    expect(String(logSpy.mock.calls[0]?.[0])).toMatch(/^ID\s+STATUS/);
    expect(String(logSpy.mock.calls[1]?.[0])).toContain('failed');
  });

  it('says when nothing runs', async () => {
    const api = fakeApi(route('GET', '/microvms', () => json({ data: [], pagination: {} })));

    await run(
      listMicroVms({ app: Option.none(), status: Option.none(), all: false, limit: 50, json: false }),
      api.layer
    );

    expect(String(logSpy.mock.calls[0]?.[0])).toContain('No running microVMs');
  });
});

describe('extendMicroVm', () => {
  it('sends the new lifetime', async () => {
    const api = fakeApi(route('POST', '/microvms/vm-1/timeout', () => json(vmInfo())));

    await run(extendMicroVm('vm-1', '30m'), api.layer);

    expect(api.calls[0]?.body).toEqual({ timeoutMs: 1_800_000 });
  });

  it('refuses more than 24 hours', async () => {
    const api = fakeApi();

    const result = await run(extendMicroVm('vm-1', '2d' as string), api.layer);

    expect(Either.isLeft(result) && result.left._tag).toBe('InvalidMicroVmOptionsError');
    expect(api.calls).toHaveLength(0);
  });

  it('refuses a bare number', async () => {
    const api = fakeApi();

    const result = await run(extendMicroVm('vm-1', '30'), api.layer);

    expect(Either.isLeft(result) && result.left._tag).toBe('InvalidMicroVmOptionsError');
    expect(api.calls).toHaveLength(0);
  });
});

describe('updateMicroVmNetwork', () => {
  const flags = (overrides: Partial<{ denyEgress: boolean; allowEgress: string[]; allowAllEgress: boolean }> = {}) => ({
    denyEgress: false,
    allowEgress: [],
    allowAllEgress: false,
    ...overrides,
  });

  it('sends one of deny, an allowlist or the whole internet', async () => {
    const api = fakeApi(route('PATCH', '/microvms/vm-1/network', () => json(vmInfo())));

    await run(updateMicroVmNetwork('vm-1', flags({ denyEgress: true })), api.layer);
    await run(updateMicroVmNetwork('vm-1', flags({ allowEgress: [' api.openai.com ', '140.82.112.0/20'] })), api.layer);
    await run(updateMicroVmNetwork('vm-1', flags({ allowAllEgress: true })), api.layer);

    expect(api.calls.map((call) => call.body)).toEqual([
      { egress: 'deny' },
      { egress: 'allow', allow: ['api.openai.com', '140.82.112.0/20'] },
      { egress: 'allow' },
    ]);
  });

  it('refuses no choice, two choices and a malformed entry before calling the API', async () => {
    const api = fakeApi();

    for (const choice of [
      flags(),
      flags({ denyEgress: true, allowAllEgress: true }),
      flags({ denyEgress: true, allowEgress: ['api.openai.com'] }),
      flags({ allowEgress: ['https://api.openai.com'] }),
    ]) {
      const result = await run(updateMicroVmNetwork('vm-1', choice), api.layer);
      expect(Either.isLeft(result) && result.left._tag).toBe('InvalidMicroVmOptionsError');
    }
    expect(api.calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// exec
// ---------------------------------------------------------------------------

const silentIo = () => {
  const written: Array<{ text: string; stream: string }> = [];
  let input: ((chunk: Uint8Array) => void) | undefined;
  let end: (() => void) | undefined;
  const io: SessionIo = {
    onInput: (listener, onEnd) => {
      input = listener;
      end = onEnd;
      return () => undefined;
    },
    write: (data, stream) => written.push({ text: Buffer.from(data).toString(), stream }),
    size: () => undefined,
    onResize: () => () => undefined,
  };
  return { io, written, type: (text: string) => input?.(Buffer.from(text)), end: () => end?.() };
};

const execFlags = (overrides: Partial<ExecFlags> = {}): ExecFlags => ({
  microvmId: 'vm-1',
  command: ['ls', '-la'],
  cwd: Option.none(),
  env: [],
  user: Option.none(),
  sudo: false,
  timeout: Option.none(),
  interactive: false,
  ...overrides,
});

describe('execInMicroVm', () => {
  const execApi = (exit: { exitCode: number | null; signal: string | null }) =>
    fakeApi(
      route('GET', '/microvms/vm-1', () => json(vmInfo())),
      route('POST', '/microvms/vm-1/commands', () => json(commandInfo(), 201)),
      route('GET', '/microvms/vm-1/commands/cmd_1/logs', () =>
        sse(
          ['stdout', { data: b64('file.txt\n'), offset: 0 }],
          ['stderr', { data: b64('warning\n'), offset: 0 }],
          ['exit', exit]
        )
      ),
      route('POST', '/microvms/vm-1/commands/cmd_1/stdin', () => json(null, 204))
    );

  it('streams output to the matching local streams and returns the exit code', async () => {
    const api = execApi({ exitCode: 3, signal: null });
    const local = silentIo();

    const result = await run(
      execInMicroVm(
        execFlags({ cwd: Option.some('/app'), env: ['CI=1'], sudo: true, timeout: Option.some('1m') }),
        local.io
      ),
      api.layer
    );

    expect(result).toEqual(Either.right(3));
    expect(local.written).toEqual([
      { text: 'file.txt\n', stream: 'stdout' },
      { text: 'warning\n', stream: 'stderr' },
    ]);
    const start = api.calls.find((call) => call.method === 'POST' && call.url.pathname === '/microvms/vm-1/commands');
    expect(start?.body).toEqual({
      cmd: 'ls',
      args: ['-la'],
      cwd: '/app',
      env: { CI: '1' },
      user: 'root',
      timeoutMs: 60_000,
      wait: false,
    });
  });

  it('passes a single argument as the shell form and maps signals to 128 + n', async () => {
    const api = execApi({ exitCode: null, signal: 'SIGKILL' });

    const result = await run(execInMicroVm(execFlags({ command: ['ls -la | wc -l'] }), silentIo().io), api.layer);

    expect(result).toEqual(Either.right(137));
    const start = api.calls.find((call) => call.method === 'POST' && call.url.pathname === '/microvms/vm-1/commands');
    expect(start?.body).toEqual({ cmd: 'ls -la | wc -l', wait: false });
  });

  it('forwards stdin with --interactive and closes it at EOF', async () => {
    let release: () => void = () => undefined;
    const released = new Promise<void>((resolve) => (release = resolve));
    const api = fakeApi(
      route('GET', '/microvms/vm-1', () => json(vmInfo())),
      route('POST', '/microvms/vm-1/commands', () => json(commandInfo(), 201)),
      route('POST', '/microvms/vm-1/commands/cmd_1/stdin', () => json(null, 204)),
      // The command keeps running until the test has sent its input.
      route(
        'GET',
        '/microvms/vm-1/commands/cmd_1/logs',
        () =>
          new Response(
            new ReadableStream<Uint8Array>({
              async start(controller) {
                await released;
                controller.enqueue(new TextEncoder().encode('event: exit\ndata: {"exitCode":0,"signal":null}\n\n'));
                controller.close();
              },
            })
          )
      )
    );
    const local = silentIo();

    const pending = run(execInMicroVm(execFlags({ command: ['cat'], interactive: true }), local.io), api.layer);
    await vi.waitFor(() => expect(api.calls.some((call) => call.url.pathname.endsWith('/logs'))).toBe(true));
    local.type('hello');
    local.end();
    await vi.waitFor(() => {
      const stdin = api.calls.filter((call) => call.url.pathname.endsWith('/stdin'));
      expect(stdin.map((call) => call.url.searchParams.get('eof'))).toEqual([null, 'true']);
      expect(Buffer.from(stdin[0]?.body as Uint8Array).toString()).toBe('hello');
    });
    release();

    await expect(pending).resolves.toEqual(Either.right(0));
    const start = api.calls.find((call) => call.method === 'POST' && call.url.pathname === '/microvms/vm-1/commands');
    expect(start?.body).toMatchObject({ cmd: 'cat', stdin: true });
  });

  it('fails with a typed error when the microVM is not running', async () => {
    const api = fakeApi(
      route('GET', '/microvms/vm-1', () => json(vmInfo({ status: 'stopped' }))),
      route('POST', '/microvms/vm-1/commands', () =>
        json({ error: 'The microVM is not running', code: 'microvm_not_running' }, 409)
      )
    );

    const result = await run(execInMicroVm(execFlags(), silentIo().io), api.layer);

    expect(Either.isLeft(result) && result.left).toMatchObject({
      _tag: 'ApiRequestError',
      code: 'microvm_not_running',
    });
    expect(Either.isLeft(result) && errorMessage('run the command', result.left)).toContain(
      'gigadrive microvms create'
    );
  });
});

// ---------------------------------------------------------------------------
// cp
// ---------------------------------------------------------------------------

describe('copyFiles', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'gn-microvm-cp-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const writeRoute = route('PUT', '/microvms/vm-1/files/content', (url) =>
    json({ path: url.searchParams.get('path'), bytes: 5 })
  );

  it('uploads a file to an exact remote path', async () => {
    await writeFile(join(dir, 'a.txt'), 'hello');
    const api = fakeApi(
      route('GET', '/microvms/vm-1/files/stat', () => json({ error: 'Not found' }, 404)),
      writeRoute
    );

    const result = await run(copyFiles(join(dir, 'a.txt'), 'vm:vm-1:/app/b.txt'), api.layer);

    expect(result).toEqual(Either.right({ files: 1, bytes: 5 }));
    const put = api.calls.find((call) => call.method === 'PUT');
    expect(put?.url.searchParams.get('path')).toBe('/app/b.txt');
    expect(Buffer.from(put?.body as Uint8Array).toString()).toBe('hello');
  });

  it('uploads into an existing remote directory', async () => {
    await writeFile(join(dir, 'a.txt'), 'hello');
    const api = fakeApi(
      route('GET', '/microvms/vm-1/files/stat', () =>
        json({ path: '/app', name: 'app', type: 'directory', size: 0, mode: '0755', modifiedAt: 0 })
      ),
      writeRoute
    );

    await run(copyFiles(join(dir, 'a.txt'), 'vm:vm-1:/app'), api.layer);

    expect(api.calls.find((call) => call.method === 'PUT')?.url.searchParams.get('path')).toBe('/app/a.txt');
  });

  it('uploads a directory recursively', async () => {
    await mkdir(join(dir, 'site', 'css'), { recursive: true });
    await writeFile(join(dir, 'site', 'index.html'), '<h1>');
    await writeFile(join(dir, 'site', 'css', 'a.css'), 'a{}');
    const api = fakeApi(
      route('GET', '/microvms/vm-1/files/stat', () => json({ error: 'Not found' }, 404)),
      writeRoute
    );

    const result = await run(copyFiles(join(dir, 'site'), 'vm:vm-1:/srv/www'), api.layer);

    expect(result).toEqual(Either.right({ files: 2, bytes: 10 }));
    const paths = api.calls
      .filter((call) => call.method === 'PUT')
      .map((call) => call.url.searchParams.get('path'))
      .sort();
    expect(paths).toEqual(['/srv/www/css/a.css', '/srv/www/index.html']);
  });

  it('downloads a file into an existing local directory', async () => {
    const api = fakeApi(
      route('GET', '/microvms/vm-1/files/stat', () =>
        json({ path: '/app/out.log', name: 'out.log', type: 'file', size: 3, mode: '0644', modifiedAt: 0 })
      ),
      route('GET', '/microvms/vm-1/files/content', () => new Response('log'))
    );

    const result = await run(copyFiles('vm:vm-1:/app/out.log', dir), api.layer);

    expect(result).toEqual(Either.right({ files: 1, bytes: 3 }));
    await expect(readFile(join(dir, 'out.log'), 'utf8')).resolves.toBe('log');
  });

  it('downloads a directory recursively', async () => {
    const entry = (path: string, type: string) => ({ path, name: path, type, size: 1, mode: '0644', modifiedAt: 0 });
    const api = fakeApi(
      route('GET', '/microvms/vm-1/files/stat', () => json(entry('/app/dist', 'directory'))),
      route('GET', '/microvms/vm-1/files', () =>
        json({
          truncated: false,
          entries: [
            entry('/app/dist/index.js', 'file'),
            entry('/app/dist/lib', 'directory'),
            entry('/app/dist/lib/util.js', 'file'),
            entry('/app/dist/link', 'symlink'),
          ],
        })
      ),
      route('GET', '/microvms/vm-1/files/content', (url) => new Response(`// ${url.searchParams.get('path')}`))
    );

    const result = await run(copyFiles('vm:vm-1:/app/dist', join(dir, 'out')), api.layer);

    expect(Either.isRight(result) && result.right.files).toBe(2);
    await expect(readFile(join(dir, 'out', 'lib', 'util.js'), 'utf8')).resolves.toBe('// /app/dist/lib/util.js');
    await expect(readFile(join(dir, 'out', 'index.js'), 'utf8')).resolves.toBe('// /app/dist/index.js');
  });

  it('never writes a listed file outside the download destination', async () => {
    const entry = (path: string, type: string) => ({ path, name: path, type, size: 1, mode: '0644', modifiedAt: 0 });
    const api = fakeApi(
      route('GET', '/microvms/vm-1/files/stat', () => json(entry('/app/dist', 'directory'))),
      route('GET', '/microvms/vm-1/files', () =>
        json({
          truncated: false,
          entries: [entry('/app/dist/../../escape.js', 'file'), entry('/app/dist/ok.js', 'file')],
        })
      ),
      route('GET', '/microvms/vm-1/files/content', (url) => new Response(`// ${url.searchParams.get('path')}`))
    );

    const result = await run(copyFiles('vm:vm-1:/app/dist', join(dir, 'nested', 'out')), api.layer);

    expect(Either.isRight(result) && result.right.files).toBe(1);
    await expect(readFile(join(dir, 'nested', 'out', 'ok.js'), 'utf8')).resolves.toBe('// /app/dist/ok.js');
    await expect(readFile(join(dir, 'escape.js'), 'utf8')).rejects.toThrow();
  });

  it('refuses two local or two remote paths, and malformed remote paths', async () => {
    const api = fakeApi();
    for (const [source, target] of [
      ['a', 'b'],
      ['vm:vm-1:/a', 'vm:vm-2:/b'],
      ['vm:oops', 'b'],
    ] as const) {
      const result = await run(copyFiles(source, target), api.layer);
      expect(Either.isLeft(result) && result.left._tag).toBe('InvalidCopyTargetError');
    }
    expect(api.calls).toHaveLength(0);
  });

  it('reports a missing local file', async () => {
    const api = fakeApi(route('GET', '/microvms/vm-1/files/stat', () => json({ error: 'Not found' }, 404)));

    const result = await run(copyFiles(join(dir, 'missing'), 'vm:vm-1:/a'), api.layer);

    expect(Either.isLeft(result) && result.left._tag).toBe('LocalFileError');
  });
});

// ---------------------------------------------------------------------------
// images
// ---------------------------------------------------------------------------

describe('images', () => {
  const image = {
    id: 'img-9',
    name: 'py-ml',
    builtin: false,
    status: 'building',
    applicationId: 'a',
    organizationId: 'o',
  };

  it('creates from a registry reference', async () => {
    const api = fakeApi(route('POST', '/microvm-images', () => json(image, 202)));

    await run(
      createImage({
        name: 'py-ml',
        app: Option.none(),
        from: Option.some('python:3.13'),
        dockerfile: Option.none(),
        wait: false,
        json: true,
      }),
      api.layer
    );

    expect(api.calls[0]?.body).toEqual({
      applicationId: 'app-linked',
      name: 'py-ml',
      source: { type: 'registry', ref: 'python:3.13' },
    });
  });

  it('creates from a Dockerfile and waits', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gn-microvm-img-'));
    const dockerfile = join(dir, 'Dockerfile');
    await writeFile(dockerfile, 'FROM debian:bookworm\nRUN apt-get update');
    let polls = 0;
    const api = fakeApi(
      route('POST', '/microvm-images', () => json(image, 202)),
      route('GET', '/microvm-images/img-9', () => json({ ...image, status: ++polls > 1 ? 'ready' : 'building' }))
    );
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    try {
      const result = await run(
        createImage({
          name: 'py-ml',
          app: Option.some('app-1'),
          from: Option.none(),
          dockerfile: Option.some(dockerfile),
          wait: true,
          json: false,
        }),
        api.layer
      );
      expect(Either.isRight(result) && result.right.status).toBe('ready');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }

    expect(api.calls[0]?.body).toEqual({
      applicationId: 'app-1',
      name: 'py-ml',
      source: { type: 'dockerfile', dockerfile: 'FROM debian:bookworm\nRUN apt-get update' },
    });
  }, 15_000);

  it('needs exactly one source', async () => {
    const api = fakeApi();
    for (const [from, dockerfile] of [
      [Option.none(), Option.none()],
      [Option.some('a'), Option.some('b')],
    ] as const) {
      const result = await run(
        createImage({ name: 'x', app: Option.none(), from, dockerfile, wait: false, json: true }),
        api.layer
      );
      expect(Either.isLeft(result) && result.left._tag).toBe('InvalidMicroVmOptionsError');
    }
  });

  it('removes an image by name', async () => {
    const api = fakeApi(
      route('GET', '/microvm-images', () =>
        json({ data: [{ ...image, id: 'builtin-1', name: 'node22', builtin: true }, image] })
      ),
      route('DELETE', '/microvm-images/img-9', () => json(null, 204))
    );

    const result = await run(removeImage('py-ml', Option.none()), api.layer);

    expect(Either.isRight(result)).toBe(true);
    expect(api.calls.map((call) => `${call.method} ${call.url.pathname}`)).toEqual([
      'GET /microvm-images',
      'DELETE /microvm-images/img-9',
    ]);
  });
});

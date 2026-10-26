import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GigadriveClient } from '../client';
import { Command } from './command';
import {
  CommandFailedError,
  MicroVmCleanupError,
  MicroVmNotRunningError,
  MicroVmPortNotExposedError,
  MicroVmPreviewTokenRequiredError,
  MicroVmStartError,
  MicroVmTimeoutError,
} from './errors';
import { MicroVM } from './microvm';
import { apiError, BASE_URL, commandInfo, exit, json, out, request, setup, sseResponse, vmInfo } from './test-utils';

const originalEnv = { ...process.env };

beforeEach(() => {
  delete process.env.GIGADRIVE_APPLICATION_ID;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

const createVm = async (overrides: Parameters<typeof vmInfo>[0] = {}) => {
  const { fetch, client } = setup();
  fetch.mockResolvedValueOnce(json(vmInfo(overrides), 201));
  const vm = await MicroVM.create({ client });
  fetch.mockReset();
  return { vm, fetch, client };
};

describe('MicroVM.create', () => {
  it('converts timeout and network shorthands', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(json(vmInfo(), 201));

    const vm = await MicroVM.create({
      client,
      image: 'node22',
      vcpus: 2,
      memoryMb: 4096,
      diskMb: 20_480,
      timeout: '10m',
      ports: [3000],
      env: { NODE_ENV: 'production' },
      metadata: { user: 'u_1' },
      network: 'deny',
      applicationId: 'app-1',
    });

    expect(vm).toBeInstanceOf(MicroVM);
    expect(vm.id).toBe('vm-1');
    expect(request(fetch).json).toEqual({
      image: 'node22',
      vcpus: 2,
      memoryMb: 4096,
      diskMb: 20_480,
      timeoutMs: 600_000,
      ports: [3000],
      env: { NODE_ENV: 'production' },
      metadata: { user: 'u_1' },
      network: { egress: 'deny' },
      applicationId: 'app-1',
    });
  });

  it('starts without holding the request open and polls until the microVM runs', async () => {
    const { fetch, client } = setup();
    fetch
      .mockResolvedValueOnce(json(vmInfo({ status: 'pending' }), 202))
      .mockResolvedValueOnce(json(vmInfo({ status: 'starting' })))
      .mockResolvedValueOnce(json(vmInfo({ status: 'running' })));
    vi.useFakeTimers();
    try {
      const created = MicroVM.create({ client });
      await vi.runAllTimersAsync();
      const vm = await created;

      expect(vm.status).toBe('running');
      expect(request(fetch).query).toMatchObject({ wait: 'false' });
      expect(fetch).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('deletes the microVM when it never runs in time, so it cannot boot unseen', async () => {
    const { fetch, client } = setup();
    fetch.mockImplementation((_input, init) =>
      Promise.resolve(
        init?.method === 'DELETE' ? new Response(null, { status: 204 }) : json(vmInfo({ status: 'pending' }), 202)
      )
    );
    vi.useFakeTimers();
    try {
      const created = MicroVM.create({ client }).catch((e: unknown) => e);
      await vi.runAllTimersAsync();

      expect(await created).toBeInstanceOf(MicroVmTimeoutError);
      const last = request(fetch, fetch.mock.calls.length - 1);
      expect(last.method).toBe('DELETE');
      expect(last.path).toMatch(/\/microvms\/vm-1$/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports the microVM id when it can neither wait for it nor delete it', async () => {
    const { fetch, client } = setup();
    fetch.mockImplementation((_input, init) =>
      Promise.resolve(
        init?.method === 'DELETE' ? apiError(409, 'Conflict', 'conflict') : json(vmInfo({ status: 'pending' }), 202)
      )
    );
    vi.useFakeTimers();
    try {
      const created = MicroVM.create({ client }).catch((e: unknown) => e);
      await vi.runAllTimersAsync();

      const error = await created;
      expect(error).toBeInstanceOf(MicroVmCleanupError);
      expect(error).toMatchObject({ microvmId: 'vm-1' });
      expect((error as MicroVmCleanupError).cause).toBeInstanceOf(MicroVmTimeoutError);
      expect((error as MicroVmCleanupError).cleanupError).toBeInstanceOf(Error);
    } finally {
      vi.useRealTimers();
    }
  });

  it('passes the abort signal to the status polls of a create', async () => {
    const { fetch, client } = setup();
    const controller = new AbortController();
    let pollSignal: AbortSignal | null | undefined;
    fetch
      .mockResolvedValueOnce(json(vmInfo({ status: 'pending' }), 202))
      .mockImplementationOnce((_input, init) => {
        pollSignal = init?.signal;
        controller.abort();
        return Promise.resolve(json(vmInfo({ status: 'running' })));
      })
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.useFakeTimers();
    try {
      const created = MicroVM.create({ client, signal: controller.signal }).catch((e: unknown) => e);
      await vi.runAllTimersAsync();

      // The abort wins over the running status that arrived after it.
      expect(await created).not.toBeInstanceOf(MicroVM);
      expect(pollSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves a microVM that failed to start for the caller to inspect', async () => {
    const { fetch, client } = setup();
    fetch
      .mockResolvedValueOnce(json(vmInfo({ status: 'pending' }), 202))
      .mockResolvedValueOnce(json(vmInfo({ status: 'failed', stopReason: 'no_capacity' })));
    vi.useFakeTimers();
    try {
      const created = MicroVM.create({ client }).catch((e: unknown) => e);
      await vi.runAllTimersAsync();

      expect(await created).toMatchObject({ status: 'failed', stopReason: 'no_capacity' });
      expect(fetch.mock.calls.every(([, init]) => init?.method !== 'DELETE')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('accepts timeoutMs and a network object, and timeout wins over timeoutMs', async () => {
    const { fetch, client } = setup();
    fetch.mockImplementation(() => Promise.resolve(json(vmInfo(), 201)));

    await MicroVM.create({ client, timeoutMs: 1234, network: { egress: 'allow' } });
    await MicroVM.create({ client, timeoutMs: 1234, timeout: 5000 });

    expect(request(fetch, 0).json).toEqual({ timeoutMs: 1234, network: { egress: 'allow' } });
    expect(request(fetch, 1).json).toEqual({ timeoutMs: 5000 });
  });

  it('creates a client from config and uses its applicationId', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(json(vmInfo(), 201));

    await MicroVM.create({ client: { bearerToken: 't', baseUrl: BASE_URL, fetch, applicationId: 'app-cfg' } });

    expect(request(fetch).url.origin).toBe(BASE_URL);
    expect(request(fetch).json).toEqual({ applicationId: 'app-cfg' });
  });

  it('falls back to a client from the environment', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(json(vmInfo(), 201));
    vi.stubGlobal('fetch', fetch);
    process.env.GIGADRIVE_BEARER_TOKEN = 'env-token';
    process.env.GIGADRIVE_API_BASE_URL = BASE_URL;
    process.env.GIGADRIVE_APPLICATION_ID = 'app-env';
    try {
      await MicroVM.create();
    } finally {
      vi.unstubAllGlobals();
    }

    expect(request(fetch).headers.Authorization).toBe('Bearer env-token');
    expect(request(fetch).json).toEqual({ applicationId: 'app-env' });
  });

  it('passes wait: false through and then polls until running', async () => {
    const { fetch, client } = setup();
    fetch
      .mockResolvedValueOnce(json(vmInfo({ status: 'starting' }), 202))
      .mockResolvedValueOnce(json(vmInfo({ status: 'starting' })))
      .mockResolvedValueOnce(json(vmInfo({ status: 'running' })));

    const vm = await MicroVM.create({ client, wait: false });
    expect(vm.status).toBe('starting');
    await expect(vm.waitUntilRunning({ interval: 1 })).resolves.toBe(vm);

    expect(request(fetch, 0).query).toEqual({ wait: 'false' });
    expect(vm.status).toBe('running');
  });

  it('waitUntilRunning fails fast when the microVM failed', async () => {
    const { fetch, client } = setup();
    fetch
      .mockResolvedValueOnce(json(vmInfo({ status: 'starting' }), 202))
      .mockResolvedValueOnce(json(vmInfo({ status: 'failed', stopReason: 'boot_failed' })));
    const vm = await MicroVM.create({ client, wait: false });

    const error = await vm.waitUntilRunning({ interval: 1 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MicroVmStartError);
    expect(error).toMatchObject({ status: 'failed', stopReason: 'boot_failed' });
  });

  it('waitUntilRunning times out', async () => {
    const { fetch, client } = setup();
    fetch.mockImplementation(() => Promise.resolve(json(vmInfo({ status: 'starting' }))));
    const vm = await MicroVM.create({ client, wait: false });

    await expect(vm.waitUntilRunning({ timeout: 0 })).rejects.toBeInstanceOf(MicroVmTimeoutError);
  });
});

describe('MicroVM.get / list', () => {
  it('gets and connects by id', async () => {
    const { fetch, client } = setup();
    fetch.mockImplementation(() => Promise.resolve(json(vmInfo())));

    const vm = await MicroVM.get('vm-1', { client });
    await MicroVM.connect('vm-1', { client });

    expect(vm.slug).toBe('k3j9x2m1q8zt');
    expect(request(fetch, 1).path).toBe('/microvms/vm-1');
  });

  it('iterates all pages', async () => {
    const { fetch, client } = setup();
    fetch
      .mockResolvedValueOnce(
        json({ data: [vmInfo({ id: 'a' }), vmInfo({ id: 'b' })], pagination: { nextCursor: 'n' } })
      )
      .mockResolvedValueOnce(json({ data: [vmInfo({ id: 'c' })], pagination: {} }));

    const ids: string[] = [];
    for await (const vm of MicroVM.list({ client, status: 'running' })) ids.push(vm.id);

    expect(ids).toEqual(['a', 'b', 'c']);
    expect(request(fetch, 1).query).toEqual({ status: 'running', cursor: 'n' });
  });
});

describe('MicroVM accessors', () => {
  it('exposes info, ports and preview URLs', async () => {
    const { vm } = await createVm({ metadata: { a: 'b' } });

    expect(vm.ports).toEqual([3000]);
    expect(vm.url(3000)).toBe('https://3000-k3j9x2m1q8zt.vm.gigadrive.app');
    expect(vm.metadata).toEqual({ a: 'b' });
    expect(vm.applicationId).toBe('app-1');
    expect(vm.expiresAt).toEqual(new Date('2026-10-23T12:05:00.000Z'));
    expect(JSON.parse(JSON.stringify(vm))).toEqual(vmInfo({ metadata: { a: 'b' } }));
  });

  it('throws MicroVmPortNotExposedError for other ports', async () => {
    const { vm } = await createVm();

    expect(() => vm.url(8080)).toThrow(MicroVmPortNotExposedError);
    expect(() => vm.url(8080)).toThrow(/Exposed ports: 3000/);
  });

  it('refuses lifetimes over 24 hours before calling the API', async () => {
    const { vm, fetch, client } = await createVm();

    await expect(vm.extendTimeout('25h')).rejects.toThrow(RangeError);
    await expect(MicroVM.create({ client, timeout: 86_400_001 })).rejects.toThrow(/24 hours/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refreshes, extends, stops and deletes', async () => {
    const { vm, fetch } = await createVm();
    fetch
      .mockResolvedValueOnce(json(vmInfo({ status: 'running' })))
      .mockResolvedValueOnce(json(vmInfo({ expiresAt: '2026-10-23T13:00:00.000Z' })))
      .mockResolvedValueOnce(json(vmInfo({ status: 'stopped', stopReason: 'user' })))
      .mockResolvedValueOnce(json(null, 204));

    await vm.refresh();
    await vm.extendTimeout('1h');
    expect(vm.expiresAt).toEqual(new Date('2026-10-23T13:00:00.000Z'));
    await vm.stop();
    expect(vm.status).toBe('stopped');
    await vm.delete();

    expect(request(fetch, 1).json).toEqual({ timeoutMs: 3_600_000 });
    expect(request(fetch, 3).method).toBe('DELETE');
  });

  it('stops on async dispose and tolerates an already stopped microVM', async () => {
    const { vm, fetch } = await createVm();
    fetch
      .mockResolvedValueOnce(json(vmInfo({ status: 'stopped' })))
      .mockResolvedValueOnce(apiError(409, 'not running', 'microvm_not_running'))
      .mockResolvedValueOnce(apiError(500, 'boom'));

    await vm[Symbol.asyncDispose]();
    await expect(vm[Symbol.asyncDispose]()).resolves.toBeUndefined();
    await expect(vm[Symbol.asyncDispose]()).rejects.toMatchObject({ status: 500 });

    expect(request(fetch, 0).path).toBe('/microvms/vm-1/stop');
  });
});

describe('MicroVM.run', () => {
  it('uses one synchronous request without callbacks (shell form)', async () => {
    const { vm, fetch } = await createVm();
    fetch.mockResolvedValueOnce(
      json({ id: 'cmd_1', exitCode: 0, stdout: 'a\nb\n', stderr: '', truncated: false, durationMs: 7 })
    );

    const result = await vm.run('ls -la /app');

    expect(result).toEqual({
      commandId: 'cmd_1',
      exitCode: 0,
      signal: null,
      timedOut: false,
      stdout: 'a\nb\n',
      stderr: '',
      truncated: false,
      durationMs: 7,
    });
    expect(request(fetch).json).toEqual({ cmd: 'ls -la /app', wait: true });
  });

  it('passes args, cwd, env, user, sudo and timeout', async () => {
    const { vm, fetch } = await createVm();
    fetch.mockImplementation(() =>
      Promise.resolve(json({ id: 'c', exitCode: 0, stdout: '', stderr: '', truncated: false, durationMs: 1 }))
    );

    await vm.run('npm', ['install'], { cwd: '/app', env: { CI: '1' }, user: 'node', timeout: '2m' });
    await vm.run('apt-get', ['update'], { sudo: true, user: 'ignored' });

    expect(request(fetch, 0).json).toEqual({
      cmd: 'npm',
      args: ['install'],
      cwd: '/app',
      env: { CI: '1' },
      user: 'node',
      timeoutMs: 120_000,
      wait: true,
    });
    expect(request(fetch, 1).json).toEqual({ cmd: 'apt-get', args: ['update'], user: 'root', wait: true });
  });

  it('returns a non-zero exit as a result, and throws CommandFailedError with throwOnError', async () => {
    const { vm, fetch } = await createVm();
    const failed = {
      id: 'c',
      exitCode: 2,
      stdout: '',
      stderr: 'line1\nno such file\n',
      truncated: false,
      durationMs: 1,
    };
    fetch.mockResolvedValueOnce(json(failed)).mockResolvedValueOnce(json(failed));

    await expect(vm.run('cat nope')).resolves.toMatchObject({ exitCode: 2 });
    const error = await vm.run('cat nope', { throwOnError: true }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CommandFailedError);
    expect(error).toMatchObject({ exitCode: 2, stderr: 'line1\nno such file\n', commandId: 'c' });
    expect((error as Error).message).toContain('exited with code 2');
    expect((error as Error).message).toContain('no such file');
  });

  it('streams through a detached command when callbacks are given', async () => {
    const { vm, fetch } = await createVm();
    fetch
      .mockResolvedValueOnce(json(commandInfo({ id: 'cmd_s' }), 201))
      .mockResolvedValueOnce(
        sseResponse([out('stdout', 'one\n', 0), out('stderr', 'warn\n', 0), out('stdout', 'two\n', 4), exit(0)])
      )
      .mockResolvedValueOnce(
        json(commandInfo({ id: 'cmd_s', status: 'exited', exitCode: 0, finishedAt: '2026-10-23T12:00:02.500Z' }))
      );
    const stdout: string[] = [];
    const stderr: string[] = [];

    const result = await vm.run('npm', ['test'], {
      onStdout: (text) => {
        stdout.push(text);
      },
      onStderr: async (text) => {
        stderr.push(text);
        await Promise.resolve();
      },
    });

    expect(stdout).toEqual(['one\n', 'two\n']);
    expect(stderr).toEqual(['warn\n']);
    expect(result).toEqual({
      commandId: 'cmd_s',
      exitCode: 0,
      signal: null,
      timedOut: false,
      stdout: 'one\ntwo\n',
      stderr: 'warn\n',
      truncated: false,
      durationMs: expect.any(Number) as number,
    });
    expect(request(fetch, 0).json).toEqual({ cmd: 'npm', args: ['test'], wait: false });
    expect(request(fetch, 1).path).toBe('/microvms/vm-1/commands/cmd_s/logs');
    // The exit event carried the status, so no extra wait request was needed.
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('decodes multi-byte characters split across chunks', async () => {
    const { vm, fetch } = await createVm();
    const euro = new TextEncoder().encode('€'); // 3 bytes
    const part = (bytes: Uint8Array, offset: number) =>
      `event: stdout\ndata: ${JSON.stringify({ data: btoa(String.fromCharCode(...bytes)), offset })}\n\n`;
    fetch
      .mockResolvedValueOnce(json(commandInfo(), 201))
      .mockResolvedValueOnce(sseResponse([part(euro.subarray(0, 1), 0), part(euro.subarray(1), 1), exit(0)]));

    const result = await vm.run('echo €', { onStdout: () => undefined });

    expect(result.stdout).toBe('€');
  });

  it('reports timedOut from the synchronous result', async () => {
    const { vm, fetch } = await createVm();
    fetch.mockResolvedValueOnce(
      json({
        id: 'c',
        exitCode: null,
        signal: 'SIGKILL',
        timedOut: true,
        stdout: '',
        stderr: '',
        truncated: false,
        durationMs: 1000,
      })
    );

    await expect(vm.run('sleep 10', { timeout: '1s' })).resolves.toMatchObject({ timedOut: true, signal: 'SIGKILL' });
  });

  it('reports timedOut and the end time from the streamed exit event', async () => {
    const { vm, fetch } = await createVm();
    fetch
      .mockResolvedValueOnce(json(commandInfo({ startedAt: '2026-10-24T10:00:00.000Z' }), 201))
      .mockResolvedValueOnce(
        sseResponse([
          out('stdout', 'x', 0),
          `event: exit\ndata: ${JSON.stringify({ exitCode: null, signal: 'SIGKILL', timedOut: true, finishedAt: '2026-10-24T10:00:01.000Z' })}\n\n`,
        ])
      );

    const result = await vm.run('sleep 10', { timeout: '1s', onStdout: () => undefined });

    expect(result).toMatchObject({ timedOut: true, signal: 'SIGKILL', durationMs: 1000 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('marks truncated output from a truncated event', async () => {
    const { vm, fetch } = await createVm();
    fetch
      .mockResolvedValueOnce(json(commandInfo(), 201))
      .mockResolvedValueOnce(sseResponse(['event: truncated\ndata: {}\n\n', out('stdout', 'x', 0), exit(0)]))
      .mockResolvedValueOnce(json(commandInfo({ status: 'exited', exitCode: 0, timedOut: true })));

    const result = await vm.run('x', { onStdout: () => undefined });

    expect(result.truncated).toBe(true);
  });

  it('marks truncated output when the stream starts past the requested offset', async () => {
    const { vm, fetch } = await createVm();
    fetch
      .mockResolvedValueOnce(json(commandInfo(), 201))
      .mockResolvedValueOnce(sseResponse([out('stdout', 'tail', 9_000_000), exit(0)]));

    const result = await vm.run('yes | head -c 9000004', { onStdout: () => undefined });

    expect(result.truncated).toBe(true);
    expect(result.stdout).toBe('tail');
  });

  it('writes stdin and closes it before streaming', async () => {
    const { vm, fetch } = await createVm();
    fetch
      .mockResolvedValueOnce(json(commandInfo({ id: 'cmd_in' }), 201))
      .mockResolvedValueOnce(json(null, 204))
      .mockResolvedValueOnce(sseResponse([out('stdout', 'HELLO', 0), exit(0)]));

    const result = await vm.run('tr a-z A-Z', { stdin: 'hello' });

    expect(result.stdout).toBe('HELLO');
    expect(request(fetch, 0).json).toEqual({ cmd: 'tr a-z A-Z', stdin: true, wait: false });
    expect(request(fetch, 1).path).toBe('/microvms/vm-1/commands/cmd_in/stdin');
    expect(request(fetch, 1).query).toEqual({ eof: 'true' });
    expect(request(fetch, 1).body).toBe('hello');
  });

  it('reports a signal-killed command and throws with throwOnError', async () => {
    const { vm, fetch } = await createVm();
    fetch.mockResolvedValueOnce(json(commandInfo(), 201)).mockResolvedValueOnce(sseResponse([exit(null, 'SIGKILL')]));

    const error = await vm.run('sleep 100', { onStdout: () => undefined, throwOnError: true }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CommandFailedError);
    expect(error).toMatchObject({ exitCode: null, signal: 'SIGKILL' });
    expect((error as Error).message).toContain('killed by SIGKILL');
  });

  it('kills the command when the signal aborts', async () => {
    const { vm, fetch } = await createVm();
    const controller = new AbortController();
    fetch.mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/commands')) return Promise.resolve(json(commandInfo({ id: 'cmd_k' }), 201));
      if (url.endsWith('/signal')) return Promise.resolve(json(null, 204));
      // The log stream hangs until aborted.
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        controller.abort();
      });
    });

    await expect(vm.run('sleep 100', { signal: controller.signal })).rejects.toThrow();

    await vi.waitFor(() => {
      const signal = fetch.mock.calls.findIndex(([input]) => String(input).endsWith('/signal'));
      expect(signal).toBeGreaterThan(-1);
      expect(request(fetch, signal).json).toEqual({ signal: 'SIGKILL' });
    });
  });

  it('rejects at once when the signal already aborted', async () => {
    const { vm, fetch } = await createVm();
    const controller = new AbortController();
    controller.abort();

    await expect(vm.run('ls', { signal: controller.signal })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('surfaces MicroVmNotRunningError', async () => {
    const { vm, fetch } = await createVm();
    fetch.mockResolvedValueOnce(apiError(409, 'The microVM is not running', 'microvm_not_running'));

    await expect(vm.run('ls')).rejects.toBeInstanceOf(MicroVmNotRunningError);
  });
});

describe('MicroVM.spawn and Command', () => {
  it('starts a detached command and returns a handle', async () => {
    const { vm, fetch } = await createVm();
    fetch.mockResolvedValueOnce(json(commandInfo(), 201));

    const command = await vm.spawn('node', ['server.js'], { cwd: '/app', stdin: true });

    expect(command).toBeInstanceOf(Command);
    expect(command.id).toBe('cmd_0123456789abcdef');
    expect(command.status).toBe('running');
    expect(command.pid).toBe(42);
    expect(command.timedOut).toBe(false);
    expect(command.truncated).toBe(false);
    expect(request(fetch).json).toEqual({ cmd: 'node', args: ['server.js'], cwd: '/app', stdin: true, wait: false });
  });

  it('expands pty: true to 80x24', async () => {
    const { vm, fetch } = await createVm();
    fetch.mockImplementation(() => Promise.resolve(json(commandInfo({ pty: true }), 201)));

    await vm.spawn('bash', { pty: true });
    await vm.spawn('bash', { pty: { cols: 120, rows: 40 } });

    expect(request(fetch, 0).json).toEqual({ cmd: 'bash', pty: { cols: 80, rows: 24 }, wait: false });
    expect(request(fetch, 1).json).toEqual({ cmd: 'bash', pty: { cols: 120, rows: 40 }, wait: false });
  });

  it('iterates logs with text and bytes and records the exit', async () => {
    const { vm, fetch } = await createVm();
    fetch
      .mockResolvedValueOnce(json(commandInfo(), 201))
      .mockResolvedValueOnce(sseResponse([out('stdout', 'listening', 0), exit(0)]));
    const command = await vm.spawn('node', ['server.js']);

    const chunks = [];
    for await (const chunk of command.logs()) chunks.push(chunk);

    expect(chunks).toEqual([
      { stream: 'stdout', text: 'listening', data: new TextEncoder().encode('listening'), offset: 0 },
    ]);
    expect(command.status).toBe('exited');
    expect(command.exitCode).toBe(0);
  });

  it('collects stdout, stderr and output', async () => {
    const { vm, fetch } = await createVm();
    const stream = () => sseResponse([out('stdout', 'o', 0), out('stderr', 'e', 0), exit(0)]);
    fetch
      .mockResolvedValueOnce(json(commandInfo(), 201))
      .mockResolvedValueOnce(stream())
      .mockResolvedValueOnce(stream())
      .mockResolvedValueOnce(stream());
    const command = await vm.spawn('x');

    await expect(command.stdout()).resolves.toBe('o');
    await expect(command.stderr()).resolves.toBe('e');
    await expect(command.output()).resolves.toEqual({ stdout: 'o', stderr: 'e' });
  });

  it('waits in bounded long-polls until the command exits', async () => {
    const { vm, fetch } = await createVm();
    fetch
      .mockResolvedValueOnce(json(commandInfo(), 201))
      .mockResolvedValueOnce(json(commandInfo()))
      .mockResolvedValueOnce(json(commandInfo({ status: 'exited', exitCode: 0 })));
    const command = await vm.spawn('sleep 1');

    await expect(command.wait()).resolves.toMatchObject({ status: 'exited', exitCode: 0 });

    expect(request(fetch, 1).path).toBe('/microvms/vm-1/commands/cmd_0123456789abcdef/wait');
    expect(request(fetch, 1).json).toEqual({ timeoutMs: 60_000 });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('wait honours timeout and throwOnError', async () => {
    const { vm, fetch } = await createVm();
    let exited = false;
    fetch.mockImplementation(async (input) => {
      if (String(input).endsWith('/commands')) return json(commandInfo(), 201);
      if (exited) return json(commandInfo({ status: 'exited', exitCode: 1 }));
      // The API holds the wait open for its timeout, then reports the command still running.
      await new Promise((resolve) => setTimeout(resolve, 30));
      return json(commandInfo());
    });
    const command = await vm.spawn('false');

    await expect(command.wait({ timeout: 20 })).rejects.toBeInstanceOf(MicroVmTimeoutError);
    const { timeoutMs } = request(fetch, 1).json as { timeoutMs: number };
    expect(timeoutMs).toBeGreaterThan(0);
    expect(timeoutMs).toBeLessThanOrEqual(20);

    exited = true;
    await expect(command.wait({ throwOnError: true })).rejects.toBeInstanceOf(CommandFailedError);
  });

  it('delivers spawn callbacks in the background and wait waits for them', async () => {
    const { vm, fetch } = await createVm();
    fetch.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/commands')) return Promise.resolve(json(commandInfo(), 201));
      if (url.includes('/logs')) return Promise.resolve(sseResponse([out('stdout', 'ready', 0), exit(0)]));
      return Promise.resolve(json(commandInfo({ status: 'exited', exitCode: 0 })));
    });
    const seen: string[] = [];

    const command = await vm.spawn('node', ['server.js'], { onStdout: (text) => void seen.push(text) });
    await command.wait();

    expect(seen).toEqual(['ready']);
  });

  it('rethrows a background callback failure from wait', async () => {
    const { vm, fetch } = await createVm();
    fetch.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/commands')) return Promise.resolve(json(commandInfo(), 201));
      if (url.includes('/logs')) return Promise.resolve(sseResponse([out('stdout', 'x', 0), exit(0)]));
      return Promise.resolve(json(commandInfo({ status: 'exited', exitCode: 0 })));
    });
    const boom = new Error('callback failed');

    const command = await vm.spawn('x', {
      onStdout: () => {
        throw boom;
      },
    });

    await expect(command.wait()).rejects.toBe(boom);
  });

  it('kills, writes, ends and resizes', async () => {
    const { vm, fetch } = await createVm();
    fetch.mockResolvedValueOnce(json(commandInfo({ pty: true }), 201)).mockResolvedValue(json(null, 204));
    const command = await vm.spawn('bash', { pty: true });

    await command.write('ls\n');
    await command.resize(100, 30);
    await command.kill();
    await command.kill('SIGKILL');
    await command.end();

    const base = '/microvms/vm-1/commands/cmd_0123456789abcdef';
    expect(request(fetch, 1).path).toBe(`${base}/stdin`);
    expect(request(fetch, 1).body).toBe('ls\n');
    expect(request(fetch, 2).json).toEqual({ cols: 100, rows: 30 });
    expect(request(fetch, 3).json).toEqual({ signal: 'SIGTERM' });
    expect(request(fetch, 4).json).toEqual({ signal: 'SIGKILL' });
    expect(request(fetch, 5).query).toEqual({ eof: 'true' });
    expect(request(fetch, 5).body).toEqual(new Uint8Array(0));
  });

  it('reattaches with vm.commands.get and lists commands', async () => {
    const { vm, fetch } = await createVm();
    fetch
      .mockResolvedValueOnce(json(commandInfo({ id: 'cmd_old', status: 'exited', exitCode: 0 })))
      .mockResolvedValueOnce(json({ data: [commandInfo({ id: 'a' }), commandInfo({ id: 'b' })] }))
      .mockResolvedValueOnce(json(commandInfo({ id: 'cmd_old', status: 'exited', exitCode: 0 })));

    const command = await vm.commands.get('cmd_old');
    const all = await vm.commands.list();
    await command.refresh();

    expect(command.exitCode).toBe(0);
    expect(all.map((c) => c.id)).toEqual(['a', 'b']);
    expect(request(fetch, 0).path).toBe('/microvms/vm-1/commands/cmd_old');
    expect(JSON.parse(JSON.stringify(command))).toMatchObject({ id: 'cmd_old' });
  });

  it('wait on an already exited command makes no request', async () => {
    const { vm, fetch } = await createVm();
    fetch.mockResolvedValueOnce(json(commandInfo({ status: 'exited', exitCode: 0 })));
    const command = await vm.commands.get('cmd_done');

    await command.wait();

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('MicroVM.files', () => {
  const entry = (path: string, type = 'file') => ({
    path,
    name: path.split('/').pop(),
    type,
    size: 1,
    mode: '0644',
    modifiedAt: 1,
  });

  it('binds the microVM id and decodes text', async () => {
    const { vm, fetch } = await createVm();
    fetch
      .mockResolvedValueOnce(json({ path: '/a.txt', bytes: 2 }))
      .mockResolvedValueOnce(new Response('hi'))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2])))
      .mockResolvedValueOnce(new Response('streamed'));

    await vm.files.write('/a.txt', 'hi');
    await expect(vm.files.readText('/a.txt')).resolves.toBe('hi');
    await expect(vm.files.read('/b.bin')).resolves.toEqual(new Uint8Array([1, 2]));
    const stream = await vm.files.readStream('/c');
    await expect(new Response(stream).text()).resolves.toBe('streamed');

    expect(request(fetch, 0).path).toBe('/microvms/vm-1/files/content');
    expect(request(fetch, 0).query).toEqual({ path: '/a.txt' });
  });

  it('writes many files with bounded concurrency, in input order', async () => {
    const { vm, fetch } = await createVm();
    let inFlight = 0;
    let peak = 0;
    fetch.mockImplementation(async (input) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      const path = new URL(String(input)).searchParams.get('path');
      return json({ path, bytes: 1 });
    });
    const files = Array.from({ length: 7 }, (_, i) => ({
      path: `/f${i}`,
      content: 'x',
      mode: i === 0 ? '0755' : undefined,
    }));

    const results = await vm.files.writeMany(files, { concurrency: 3 });

    expect(results.map((r) => r.path)).toEqual(files.map((f) => f.path));
    expect(peak).toBe(3);
    const first = fetch.mock.calls.findIndex(([input]) => String(input).includes('path=%2Ff0'));
    expect(request(fetch, first).query).toEqual({ path: '/f0', mode: '0755' });
  });

  it('writeMany with no files makes no request', async () => {
    const { vm, fetch } = await createVm();

    await expect(vm.files.writeMany([])).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('lists, stats, makes directories, moves and removes', async () => {
    const { vm, fetch } = await createVm();
    fetch
      .mockResolvedValueOnce(json({ entries: [entry('/root/a')] }))
      .mockResolvedValueOnce(json(entry('/x')))
      .mockResolvedValueOnce(json(entry('/d', 'directory')))
      .mockResolvedValueOnce(json(entry('/y')))
      .mockResolvedValueOnce(json(null, 204));

    await expect(vm.files.list()).resolves.toHaveLength(1);
    await vm.files.stat('/x');
    await vm.files.mkdir('/d');
    await vm.files.move('/x', '/y');
    await vm.files.remove('/d', { recursive: true });

    expect(request(fetch, 0).query).toEqual({ path: '.' });
    expect(request(fetch, 4).query).toEqual({ path: '/d', recursive: 'true' });
  });

  it('exists is false only for a missing file', async () => {
    const { vm, fetch } = await createVm();
    fetch
      .mockResolvedValueOnce(json(entry('/here')))
      .mockResolvedValueOnce(apiError(404, 'No such file'))
      .mockResolvedValueOnce(apiError(409, 'not running', 'microvm_not_running'));

    await expect(vm.files.exists('/here')).resolves.toBe(true);
    await expect(vm.files.exists('/gone')).resolves.toBe(false);
    await expect(vm.files.exists('/x')).rejects.toBeInstanceOf(MicroVmNotRunningError);
  });
});

describe('MicroVM private previews', () => {
  const PRIVATE = { network: { egress: 'allow' as const, previews: 'private' as const } };
  const TOKEN = 'gdpv_test-token';

  const createPrivate = async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(json({ ...vmInfo(PRIVATE), previewToken: TOKEN }, 201));
    const vm = await MicroVM.create({ client, ports: [3000], previews: 'private' });
    const created = request(fetch);
    fetch.mockReset();
    return { vm, fetch, client, created };
  };

  it('asks for private previews and keeps the token the create answer shows once', async () => {
    const { vm, created } = await createPrivate();

    expect(created.json).toMatchObject({ network: { egress: 'allow', previews: 'private' } });
    expect(vm.previewToken).toBe(TOKEN);
    // The token is not part of the API object a caller may log or persist.
    expect(JSON.stringify(vm.toJSON())).not.toContain(TOKEN);
  });

  it('merges previews into a network policy or shorthand', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(json({ ...vmInfo(PRIVATE), previewToken: TOKEN }, 201));

    await MicroVM.create({ client, network: 'deny', previews: 'private' });

    expect(request(fetch).json).toMatchObject({ network: { egress: 'deny', previews: 'private' } });
  });

  it('shares a link that carries the token once, and a plain URL for public previews', async () => {
    const { vm } = await createPrivate();
    const { vm: publicVm } = await createVm();

    expect(vm.shareUrl(3000)).toBe(`https://3000-k3j9x2m1q8zt.vm.gigadrive.app/?gd_preview_token=${TOKEN}`);
    expect(publicVm.shareUrl(3000)).toBe('https://3000-k3j9x2m1q8zt.vm.gigadrive.app');
    expect(() => vm.shareUrl(8080)).toThrow(MicroVmPortNotExposedError);
  });

  it('waits for a private port with the token header', async () => {
    const { vm, fetch } = await createPrivate();
    fetch
      .mockResolvedValueOnce(new Response(null, { status: 502 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    await expect(vm.waitForPort(3000, { interval: 1 })).resolves.toBe('https://3000-k3j9x2m1q8zt.vm.gigadrive.app');

    expect(request(fetch, 0).headers).toEqual({ 'x-gigadrive-preview-token': TOKEN });
    expect(request(fetch, 1).headers).toEqual({ 'x-gigadrive-preview-token': TOKEN });
  });

  it("fails at once when the gateway refuses the token, but not on the server's own 401", async () => {
    const { vm, fetch } = await createPrivate();
    fetch.mockResolvedValueOnce(
      new Response('private', { status: 401, headers: { 'x-gigadrive-error': 'EDGE_MICROVM_PREVIEW_UNAUTHORIZED' } })
    );
    await expect(vm.waitForPort(3000, { interval: 1 })).rejects.toBeInstanceOf(MicroVmPreviewTokenRequiredError);
    expect(fetch).toHaveBeenCalledTimes(1);

    fetch.mockReset();
    fetch.mockResolvedValueOnce(new Response('sign in', { status: 401 }));
    await expect(vm.waitForPort(3000, { interval: 1 })).resolves.toBe('https://3000-k3j9x2m1q8zt.vm.gigadrive.app');
  });

  it('needs the token to wait for or share a private microVM it reconnected to', async () => {
    const { fetch, client } = setup();
    fetch.mockImplementation(() => Promise.resolve(json(vmInfo(PRIVATE))));

    const without = await MicroVM.get('vm-1', { client });
    expect(without.previewToken).toBeUndefined();
    await expect(without.waitForPort(3000)).rejects.toBeInstanceOf(MicroVmPreviewTokenRequiredError);
    expect(() => without.shareUrl(3000)).toThrow(MicroVmPreviewTokenRequiredError);
    expect(fetch).toHaveBeenCalledTimes(1);

    const withToken = await MicroVM.get('vm-1', { client, previewToken: TOKEN });
    expect(withToken.previewToken).toBe(TOKEN);
    expect(withToken.shareUrl(3000)).toContain(`gd_preview_token=${TOKEN}`);
  });

  it('rotates the token and keeps the new one', async () => {
    const { vm, fetch } = await createPrivate();
    fetch.mockResolvedValueOnce(json({ previewToken: 'gdpv_rotated' }));

    await expect(vm.rotatePreviewToken()).resolves.toBe('gdpv_rotated');

    expect(request(fetch)).toMatchObject({ method: 'POST', path: '/microvms/vm-1/preview-token' });
    expect(vm.previewToken).toBe('gdpv_rotated');
  });
});

describe('MicroVM.waitForPort', () => {
  it('polls the preview URL without credentials until the gateway stops answering 502', async () => {
    const { vm, fetch } = await createVm();
    fetch
      .mockResolvedValueOnce(new Response('bad gateway', { status: 502 }))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response('not found', { status: 404 }));

    await expect(vm.waitForPort(3000, { interval: 1, path: 'health' })).resolves.toBe(
      'https://3000-k3j9x2m1q8zt.vm.gigadrive.app'
    );

    expect(fetch).toHaveBeenCalledTimes(3);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://3000-k3j9x2m1q8zt.vm.gigadrive.app/health');
    expect(init?.headers).toBeUndefined();
    expect(init?.redirect).toBe('manual');
  });

  it('fails fast once the gateway says the microVM stopped', async () => {
    const { vm, fetch } = await createVm();
    fetch.mockResolvedValueOnce(
      new Response('gone', { status: 410, headers: { 'x-gigadrive-error': 'EDGE_MICROVM_STOPPED' } })
    );

    await expect(vm.waitForPort(3000, { interval: 1 })).rejects.toBeInstanceOf(MicroVmNotRunningError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("treats the customer server's own 410 as an answer", async () => {
    const { vm, fetch } = await createVm();
    fetch.mockResolvedValueOnce(new Response('gone', { status: 410 }));

    await expect(vm.waitForPort(3000, { interval: 1 })).resolves.toBe('https://3000-k3j9x2m1q8zt.vm.gigadrive.app');
  });

  it('times out', async () => {
    const { vm, fetch } = await createVm();
    fetch.mockImplementation(() => Promise.resolve(new Response(null, { status: 503 })));

    await expect(vm.waitForPort(3000, { timeout: 0 })).rejects.toBeInstanceOf(MicroVmTimeoutError);
  });

  it('refuses a port that is not exposed without making requests', async () => {
    const { vm, fetch } = await createVm({ ports: [] });

    await expect(vm.waitForPort(3000)).rejects.toBeInstanceOf(MicroVmPortNotExposedError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('stops when the signal aborts', async () => {
    const { vm, fetch } = await createVm();
    const controller = new AbortController();
    fetch.mockImplementation(() => {
      controller.abort();
      return Promise.resolve(new Response(null, { status: 502 }));
    });

    await expect(vm.waitForPort(3000, { signal: controller.signal, interval: 1 })).rejects.toThrow();
  });
});

describe('client integration', () => {
  it('exposes the low-level resource on GigadriveClient', () => {
    const client = new GigadriveClient({ bearerToken: 't', fetch: vi.fn<typeof globalThis.fetch>() });

    expect(client.microvms.commands).toBeDefined();
    expect(client.microvms.files).toBeDefined();
    expect(client.microvms.images).toBeDefined();
  });
});

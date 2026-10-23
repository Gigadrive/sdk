import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../errors';
import {
  MicroVmBusyError,
  MicroVmFileNotFoundError,
  MicroVmImageBuildError,
  MicroVmImageNotReadyError,
  MicroVmNotFoundError,
  MicroVmNotRunningError,
  MicroVmQuotaExceededError,
  MicroVmTimeoutError,
  MicroVmUnreachableError,
} from './errors';
import { apiError, commandInfo, exit, json, out, request, setup, sseResponse, vmInfo } from './test-utils';

const originalApplicationId = process.env.GIGADRIVE_APPLICATION_ID;

beforeEach(() => {
  delete process.env.GIGADRIVE_APPLICATION_ID;
});

afterEach(() => {
  if (originalApplicationId === undefined) delete process.env.GIGADRIVE_APPLICATION_ID;
  else process.env.GIGADRIVE_APPLICATION_ID = originalApplicationId;
  vi.useRealTimers();
});

describe('MicroVmsResource', () => {
  it('creates a microVM and waits by default', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(json(vmInfo(), 201));

    const vm = await client.microvms.create({ image: 'python3.13', vcpus: 2, ports: [8000], env: { A: '1' } });

    expect(vm.id).toBe('vm-1');
    const req = request(fetch);
    expect(req.method).toBe('POST');
    expect(req.path).toBe('/microvms');
    expect(req.query).toEqual({});
    expect(req.json).toEqual({ image: 'python3.13', vcpus: 2, ports: [8000], env: { A: '1' } });
    expect(req.headers.Authorization).toBe('Bearer test-token');
  });

  it('sends wait=false when asked not to wait', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(json(vmInfo({ status: 'starting' }), 202));

    const vm = await client.microvms.create({}, { wait: false });

    expect(vm.status).toBe('starting');
    expect(request(fetch).query).toEqual({ wait: 'false' });
    expect(request(fetch).json).toEqual({});
  });

  it('fills applicationId from the client, and an explicit one wins', async () => {
    const { fetch, client } = setup({ applicationId: 'app-default' });
    fetch.mockImplementation(() => Promise.resolve(json(vmInfo(), 201)));

    await client.microvms.create({ image: 'node22' });
    await client.microvms.create({ applicationId: 'app-explicit' });

    expect(request(fetch, 0).json).toEqual({ image: 'node22', applicationId: 'app-default' });
    expect(request(fetch, 1).json).toEqual({ applicationId: 'app-explicit' });
  });

  it('falls back to GIGADRIVE_APPLICATION_ID', async () => {
    process.env.GIGADRIVE_APPLICATION_ID = 'app-env';
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(json(vmInfo(), 201));

    await client.microvms.create();

    expect(request(fetch).json).toEqual({ applicationId: 'app-env' });
  });

  it('ignores an empty GIGADRIVE_APPLICATION_ID', async () => {
    process.env.GIGADRIVE_APPLICATION_ID = '';
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(json({ data: [], pagination: {} }));

    await client.microvms.list();

    expect(request(fetch).query).toEqual({});
  });

  it('lists a page from the { data, pagination } envelope', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(json({ data: [vmInfo()], pagination: { nextCursor: 'c2', hasMore: true } }));

    const page = await client.microvms.list({ status: 'running', limit: 10, applicationId: 'app-1' });

    expect(page).toEqual({ items: [vmInfo()], nextCursor: 'c2', hasMore: true });
    expect(request(fetch).path).toBe('/microvms');
    expect(request(fetch).query).toEqual({ status: 'running', limit: '10', applicationId: 'app-1' });
  });

  it('accepts an { items, nextCursor } envelope and omits a null cursor', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(json({ items: [vmInfo()], nextCursor: null }));

    await expect(client.microvms.list()).resolves.toEqual({ items: [vmInfo()], hasMore: false });
  });

  it('stops paging when hasMore is false even with a cursor', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(json({ data: [vmInfo()], pagination: { nextCursor: 'stale', hasMore: false } }));

    const ids: string[] = [];
    for await (const vm of client.microvms.listAll()) ids.push(vm.id);

    expect(ids).toEqual(['vm-1']);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('iterates every page with listAll', async () => {
    const { fetch, client } = setup();
    fetch
      .mockResolvedValueOnce(json({ data: [vmInfo({ id: 'a' })], pagination: { nextCursor: 'c2', hasMore: true } }))
      .mockResolvedValueOnce(json({ data: [vmInfo({ id: 'b' })], pagination: { nextCursor: null, hasMore: false } }));

    const ids: string[] = [];
    for await (const vm of client.microvms.listAll({ status: 'running' })) ids.push(vm.id);

    expect(ids).toEqual(['a', 'b']);
    expect(request(fetch, 0).query).toEqual({ status: 'running' });
    expect(request(fetch, 1).query).toEqual({ status: 'running', cursor: 'c2' });
  });

  it('gets, extends, stops and deletes', async () => {
    const { fetch, client } = setup();
    fetch
      .mockResolvedValueOnce(json(vmInfo()))
      .mockResolvedValueOnce(json(vmInfo({ timeoutMs: 600_000 })))
      .mockResolvedValueOnce(json(vmInfo({ status: 'stopped' })))
      .mockResolvedValueOnce(json(null, 204));

    await client.microvms.get('vm-1');
    await expect(client.microvms.extendTimeout('vm-1', 600_000)).resolves.toMatchObject({ timeoutMs: 600_000 });
    await expect(client.microvms.stop('vm-1')).resolves.toMatchObject({ status: 'stopped' });
    await expect(client.microvms.delete('vm-1')).resolves.toBeUndefined();

    expect([0, 1, 2, 3].map((i) => `${request(fetch, i).method} ${request(fetch, i).path}`)).toEqual([
      'GET /microvms/vm-1',
      'POST /microvms/vm-1/timeout',
      'POST /microvms/vm-1/stop',
      'DELETE /microvms/vm-1',
    ]);
    expect(request(fetch, 1).json).toEqual({ timeoutMs: 600_000 });
  });

  it('encodes ids in paths', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(json(vmInfo()));

    await client.microvms.get('a/b');

    expect(request(fetch).url.href).toBe('https://api.test/microvms/a%2Fb');
  });

  describe('errors', () => {
    it('maps 409 microvm_not_running to MicroVmNotRunningError', async () => {
      const { fetch, client } = setup();
      fetch.mockResolvedValueOnce(apiError(409, 'The microVM is not running', 'microvm_not_running'));

      const error = await client.microvms.commands.run('vm-1', { cmd: 'ls' }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(MicroVmNotRunningError);
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: 409, code: 'microvm_not_running' });
    });

    it('recognises not-running from the message when the API sends no code', async () => {
      const { fetch, client } = setup();
      fetch.mockResolvedValueOnce(apiError(409, 'microvm_not_running'));

      await expect(client.microvms.stop('vm-1')).rejects.toBeInstanceOf(MicroVmNotRunningError);
    });

    it('keeps other 409s as plain ApiError', async () => {
      const { fetch, client } = setup();
      fetch.mockResolvedValueOnce(apiError(409, 'File exists', 'already_exists'));

      const error = await client.microvms.files.move('vm-1', '/a', '/b').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).not.toBeInstanceOf(MicroVmNotRunningError);
    });

    it('maps 404 to MicroVmNotFoundError, and to MicroVmFileNotFoundError on file routes', async () => {
      const { fetch, client } = setup();
      fetch.mockResolvedValueOnce(apiError(404, 'Not found')).mockResolvedValueOnce(apiError(404, 'No such file'));

      const vmError = await client.microvms.get('missing').catch((e: unknown) => e);
      const fileError = await client.microvms.files.stat('vm-1', '/nope').catch((e: unknown) => e);

      expect(vmError).toBeInstanceOf(MicroVmNotFoundError);
      expect(vmError).not.toBeInstanceOf(MicroVmFileNotFoundError);
      expect(fileError).toBeInstanceOf(MicroVmFileNotFoundError);
      expect(fileError).toMatchObject({ path: '/nope', status: 404 });
    });

    it('treats a microvm_not_found 404 on a file route as the microVM missing', async () => {
      const { fetch, client } = setup();
      fetch.mockResolvedValueOnce(apiError(404, 'MicroVM not found', 'microvm_not_found'));

      const error = await client.microvms.files.stat('vm-x', '/a').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(MicroVmNotFoundError);
      expect(error).not.toBeInstanceOf(MicroVmFileNotFoundError);
    });

    it('treats a not_found 404 on a file route as the microVM missing, and guest_not_found as the file', async () => {
      const { fetch, client } = setup();
      fetch
        .mockResolvedValueOnce(apiError(404, 'microVM not found', 'not_found'))
        .mockResolvedValueOnce(apiError(404, 'No such file', 'guest_not_found'));

      const vmError = await client.microvms.files.read('vm-x', '/a').catch((e: unknown) => e);
      const fileError = await client.microvms.files.read('vm-1', '/a').catch((e: unknown) => e);

      expect(vmError).toBeInstanceOf(MicroVmNotFoundError);
      expect(vmError).not.toBeInstanceOf(MicroVmFileNotFoundError);
      expect(fileError).toBeInstanceOf(MicroVmFileNotFoundError);
    });

    it('maps microvm_unreachable and image_not_ready', async () => {
      const { fetch, client } = setup();
      fetch
        .mockResolvedValueOnce(apiError(502, 'The microVM is unreachable', 'microvm_unreachable'))
        .mockResolvedValueOnce(apiError(409, 'The image is still building', 'image_not_ready'));

      await expect(client.microvms.commands.signal('vm-1', 'cmd_1', 'SIGTERM')).rejects.toBeInstanceOf(
        MicroVmUnreachableError
      );
      const error = await client.microvms.create({ image: 'py-ml' }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(MicroVmImageNotReadyError);
      expect(error).not.toBeInstanceOf(MicroVmNotRunningError);
    });

    it('retries reads while the microVM is busy', async () => {
      const { fetch, client } = setup();
      fetch
        .mockResolvedValueOnce(apiError(503, 'Busy', 'microvm_busy'))
        .mockResolvedValueOnce(apiError(429, 'Busy', 'microvm_busy'))
        .mockResolvedValueOnce(json(vmInfo()));

      await expect(client.microvms.get('vm-1')).resolves.toMatchObject({ id: 'vm-1' });
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('does not retry mutations while busy, and surfaces MicroVmBusyError', async () => {
      const { fetch, client } = setup();
      fetch.mockImplementation(() => Promise.resolve(apiError(429, 'Busy', 'microvm_busy')));

      const error = await client.microvms.commands.start('vm-1', { cmd: 'ls' }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(MicroVmBusyError);
      expect(error).toMatchObject({ status: 429, code: 'microvm_busy' });
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('keeps a 429 quota_exceeded a quota error, not busy', async () => {
      const { fetch, client } = setup();
      fetch.mockResolvedValueOnce(apiError(429, 'Too many microVMs', 'quota_exceeded'));

      const error = await client.microvms.get('vm-1').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(MicroVmQuotaExceededError);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('maps quota errors', async () => {
      const { fetch, client } = setup();
      fetch.mockResolvedValueOnce(apiError(402, 'Concurrent microVM limit reached', 'quota_exceeded'));

      await expect(client.microvms.create()).rejects.toBeInstanceOf(MicroVmQuotaExceededError);
    });

    it('passes non-API errors through', async () => {
      const { fetch, client } = setup();
      const network = new TypeError('fetch failed');
      fetch.mockRejectedValueOnce(network);

      await expect(client.microvms.get('vm-1')).rejects.toBe(network);
    });
  });
});

describe('MicroVmCommandsResource', () => {
  it('runs a command synchronously with wait: true', async () => {
    const { fetch, client } = setup();
    const result = {
      id: 'cmd_1',
      exitCode: 0,
      signal: null,
      timedOut: false,
      stdout: 'v22\n',
      stderr: '',
      truncated: false,
      durationMs: 12,
    };
    fetch.mockResolvedValueOnce(json(result));

    await expect(
      client.microvms.commands.run('vm-1', { cmd: 'node', args: ['-v'], cwd: '/app', timeoutMs: 1000 })
    ).resolves.toEqual(result);
    expect(request(fetch).path).toBe('/microvms/vm-1/commands');
    expect(request(fetch).json).toEqual({ cmd: 'node', args: ['-v'], cwd: '/app', timeoutMs: 1000, wait: true });
  });

  it('starts a detached command with wait: false', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(json(commandInfo(), 201));

    const command = await client.microvms.commands.start('vm-1', { cmd: 'bash', pty: { cols: 80, rows: 24 } });

    expect(command.id).toBe('cmd_0123456789abcdef');
    expect(request(fetch).json).toEqual({ cmd: 'bash', pty: { cols: 80, rows: 24 }, wait: false });
  });

  it('normalises a guest-style commandId field', async () => {
    const { fetch, client } = setup();
    const { id: _id, ...rest } = commandInfo();
    fetch.mockResolvedValueOnce(json({ ...rest, commandId: 'cmd_guest' }));

    await expect(client.microvms.commands.get('vm-1', 'cmd_guest')).resolves.toMatchObject({ id: 'cmd_guest' });
  });

  it('lists commands from { data }', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(json({ data: [commandInfo()] }));

    await expect(client.microvms.commands.list('vm-1')).resolves.toEqual([commandInfo()]);
    expect(request(fetch).path).toBe('/microvms/vm-1/commands');
  });

  it('gets a command', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(json(commandInfo()));

    await client.microvms.commands.get('vm-1', 'cmd_1');

    expect(request(fetch).path).toBe('/microvms/vm-1/commands/cmd_1');
  });

  it('waits with an optional timeout', async () => {
    const { fetch, client } = setup();
    fetch.mockImplementation(() => Promise.resolve(json(commandInfo({ status: 'exited', exitCode: 0 }))));

    await client.microvms.commands.wait('vm-1', 'cmd_1', { timeoutMs: 30_000 });
    await client.microvms.commands.wait('vm-1', 'cmd_1');

    expect(request(fetch, 0).path).toBe('/microvms/vm-1/commands/cmd_1/wait');
    expect(request(fetch, 0).json).toEqual({ timeoutMs: 30_000 });
    expect(request(fetch, 1).json).toEqual({});
  });

  it('writes raw stdin bytes and closes stdin with eof', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValue(json(null, 204));
    const bytes = new Uint8Array([1, 2, 3]);

    await client.microvms.commands.stdin('vm-1', 'cmd_1', bytes);
    await client.microvms.commands.stdin('vm-1', 'cmd_1', 'bye', { eof: true });

    const first = request(fetch, 0);
    expect(first.path).toBe('/microvms/vm-1/commands/cmd_1/stdin');
    expect(first.body).toBe(bytes);
    expect(first.headers['Content-Type']).toBe('application/octet-stream');
    expect(first.query).toEqual({});
    expect(request(fetch, 1).body).toBe('bye');
    expect(request(fetch, 1).query).toEqual({ eof: 'true' });
  });

  it('sends signals and resizes', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValue(json(null, 204));

    await client.microvms.commands.signal('vm-1', 'cmd_1', 'SIGINT');
    await client.microvms.commands.resize('vm-1', 'cmd_1', { cols: 120, rows: 40 });

    expect(request(fetch, 0).path).toBe('/microvms/vm-1/commands/cmd_1/signal');
    expect(request(fetch, 0).json).toEqual({ signal: 'SIGINT' });
    expect(request(fetch, 1).path).toBe('/microvms/vm-1/commands/cmd_1/resize');
    expect(request(fetch, 1).json).toEqual({ cols: 120, rows: 40 });
  });

  it('streams logs over SSE with offsets in the query', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(sseResponse([out('stdout', 'hi\n', 5), exit(0)]));

    const events = [];
    for await (const event of client.microvms.commands.logs('vm-1', 'cmd_1', { stdoutOffset: 5, stderrOffset: 2 })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'output', stream: 'stdout', data: new TextEncoder().encode('hi\n'), offset: 5 },
      { type: 'exit', exitCode: 0, signal: null },
    ]);
    const req = request(fetch);
    expect(req.path).toBe('/microvms/vm-1/commands/cmd_1/logs');
    expect(req.query).toEqual({ follow: 'true', stdoutOffset: '5', stderrOffset: '2' });
    expect(req.headers.Accept).toBe('text/event-stream');
  });

  it('ends a dropped log stream with the exit status from the command when it already exited', async () => {
    const { fetch, client } = setup();
    fetch
      .mockResolvedValueOnce(sseResponse([]))
      .mockResolvedValueOnce(json(commandInfo({ status: 'exited', exitCode: 3 })));

    const events = [];
    for await (const event of client.microvms.commands.logs('vm-1', 'cmd_1')) events.push(event);

    expect(events).toEqual([{ type: 'exit', exitCode: 3, signal: null }]);
    expect(request(fetch, 1).path).toBe('/microvms/vm-1/commands/cmd_1');
  });

  it('maps a 404 on the logs route', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(apiError(404, 'Command not found'));

    const iterate = async () => {
      for await (const _ of client.microvms.commands.logs('vm-1', 'cmd_x')) void _;
    };

    await expect(iterate()).rejects.toBeInstanceOf(MicroVmNotFoundError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('MicroVmFilesResource', () => {
  it('reads bytes with offset and length', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(new Response(new Uint8Array([104, 105])));

    await expect(client.microvms.files.read('vm-1', '/a.txt', { offset: 2, length: 2 })).resolves.toEqual(
      new Uint8Array([104, 105])
    );
    expect(request(fetch).path).toBe('/microvms/vm-1/files/content');
    expect(request(fetch).query).toEqual({ path: '/a.txt', offset: '2', length: '2' });
  });

  it('reads a stream', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(new Response('streamed'));

    const stream = await client.microvms.files.readStream('vm-1', 'a.txt');

    expect(await new Response(stream).text()).toBe('streamed');
  });

  it('writes raw content with mode and mkdirs', async () => {
    const { fetch, client } = setup();
    fetch.mockImplementation(() => Promise.resolve(json({ path: '/app/run.sh', bytes: 9 })));

    await expect(
      client.microvms.files.write('vm-1', '/app/run.sh', '#!/bin/sh', { mode: 0o755, mkdirs: false })
    ).resolves.toEqual({ path: '/app/run.sh', bytes: 9 });
    await client.microvms.files.write('vm-1', 'b.txt', new Uint8Array([1]), { mode: '0600' });

    const first = request(fetch, 0);
    expect(first.method).toBe('PUT');
    expect(first.path).toBe('/microvms/vm-1/files/content');
    expect(first.query).toEqual({ path: '/app/run.sh', mode: '0755', mkdirs: 'false' });
    expect(first.body).toBe('#!/bin/sh');
    expect(first.headers['Content-Type']).toBe('application/octet-stream');
    expect(request(fetch, 1).query).toEqual({ path: 'b.txt', mode: '0600' });
  });

  it('streams a ReadableStream body with duplex: half', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(json({ path: '/big', bytes: 3 }));
    const body = new Blob(['abc']).stream();

    await client.microvms.files.write('vm-1', '/big', body);

    const init = request(fetch).init as RequestInit & { duplex?: string };
    expect(init.body).toBe(body);
    expect(init.duplex).toBe('half');
  });

  it('lists entries, recursively', async () => {
    const { fetch, client } = setup();
    const entry = { path: '/app/a', name: 'a', type: 'file', size: 1, mode: '0644', modifiedAt: 1 };
    fetch.mockResolvedValueOnce(json({ entries: [entry], truncated: true }));

    await expect(client.microvms.files.list('vm-1', '/app', { recursive: true, depth: 3 })).resolves.toEqual({
      entries: [entry],
      truncated: true,
    });
    expect(request(fetch).path).toBe('/microvms/vm-1/files');
    expect(request(fetch).query).toEqual({ path: '/app', recursive: 'true', depth: '3' });
  });

  it('stats, makes directories, moves and removes', async () => {
    const { fetch, client } = setup();
    const entry = { path: '/d', name: 'd', type: 'directory', size: 0, mode: '0755', modifiedAt: 1 };
    fetch
      .mockResolvedValueOnce(json(entry))
      .mockResolvedValueOnce(json(entry))
      .mockResolvedValueOnce(json(entry))
      .mockResolvedValueOnce(json(entry))
      .mockResolvedValueOnce(json(null, 204));

    await client.microvms.files.stat('vm-1', '/d');
    await client.microvms.files.mkdir('vm-1', '/d');
    await client.microvms.files.mkdir('vm-1', '/d', { parents: false });
    await client.microvms.files.move('vm-1', '/d', '/e');
    await client.microvms.files.remove('vm-1', '/e', { recursive: true });

    expect(request(fetch, 0).path).toBe('/microvms/vm-1/files/stat');
    expect(request(fetch, 0).query).toEqual({ path: '/d' });
    expect(request(fetch, 1).json).toEqual({ path: '/d' });
    expect(request(fetch, 2).json).toEqual({ path: '/d', parents: false });
    expect(request(fetch, 3).path).toBe('/microvms/vm-1/files/move');
    expect(request(fetch, 3).json).toEqual({ from: '/d', to: '/e' });
    expect(request(fetch, 4).method).toBe('DELETE');
    expect(request(fetch, 4).path).toBe('/microvms/vm-1/files');
    expect(request(fetch, 4).query).toEqual({ path: '/e', recursive: 'true' });
  });
});

describe('MicroVmImagesResource', () => {
  const image = {
    id: 'img-9',
    name: 'py-ml',
    builtin: false,
    status: 'building',
    applicationId: 'app-1',
    organizationId: 'org-1',
  } as const;

  it('creates from a registry reference, a Dockerfile or a raw source', async () => {
    const { fetch, client } = setup({ applicationId: 'app-1' });
    fetch.mockImplementation(() => Promise.resolve(json(image, 202)));

    await client.microvms.images.create({ name: 'py-ml', from: 'python:3.13' });
    await client.microvms.images.create({ name: 'tool', from: { dockerfile: 'FROM debian\nRUN true' } });
    await client.microvms.images.create({ name: 'gh', from: { registry: 'ghcr.io/acme/tool:1' } });
    await client.microvms.images.create({
      name: 'raw',
      applicationId: 'app-2',
      source: { type: 'registry', ref: 'node:22' },
    });

    expect(request(fetch, 0).path).toBe('/microvm-images');
    expect(request(fetch, 0).json).toEqual({
      applicationId: 'app-1',
      name: 'py-ml',
      source: { type: 'registry', ref: 'python:3.13' },
    });
    expect(request(fetch, 1).json).toMatchObject({
      source: { type: 'dockerfile', dockerfile: 'FROM debian\nRUN true' },
    });
    expect(request(fetch, 2).json).toMatchObject({ source: { type: 'registry', ref: 'ghcr.io/acme/tool:1' } });
    expect(request(fetch, 3).json).toEqual({
      applicationId: 'app-2',
      name: 'raw',
      source: { type: 'registry', ref: 'node:22' },
    });
  });

  it('rejects a create without a source', async () => {
    const { client } = setup();

    await expect(client.microvms.images.create({ name: 'x' })).rejects.toThrow(TypeError);
  });

  it('lists, gets and deletes', async () => {
    const { fetch, client } = setup();
    fetch
      .mockResolvedValueOnce(json({ data: [image] }))
      .mockResolvedValueOnce(json([image]))
      .mockResolvedValueOnce(json(image))
      .mockResolvedValueOnce(json(null, 204));

    await expect(client.microvms.images.list({ applicationId: 'app-1' })).resolves.toEqual([image]);
    await expect(client.microvms.images.list()).resolves.toEqual([image]);
    await client.microvms.images.get('img-9');
    await client.microvms.images.delete('img-9');

    expect(request(fetch, 0).query).toEqual({ applicationId: 'app-1' });
    expect(request(fetch, 1).query).toEqual({});
    expect(request(fetch, 2).path).toBe('/microvm-images/img-9');
    expect(request(fetch, 3).method).toBe('DELETE');
    expect(request(fetch, 3).path).toBe('/microvm-images/img-9');
  });

  it('waits until an image is ready, reporting status changes', async () => {
    const { fetch, client } = setup();
    fetch
      .mockResolvedValueOnce(json(image))
      .mockResolvedValueOnce(json(image))
      .mockResolvedValueOnce(json({ ...image, status: 'ready' }));
    const statuses: string[] = [];

    const ready = await client.microvms.images.waitUntilReady('img-9', {
      interval: 1,
      onStatus: (current) => statuses.push(current.status),
    });

    expect(ready.status).toBe('ready');
    expect(statuses).toEqual(['building', 'ready']);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('throws MicroVmImageBuildError when the build failed', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(json({ ...image, status: 'failed', error: 'manifest unknown' }));

    const error = await client.microvms.images.waitUntilReady('img-9').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MicroVmImageBuildError);
    expect((error as Error).message).toContain('manifest unknown');
  });

  it('times out while still building', async () => {
    const { fetch, client } = setup();
    fetch.mockImplementation(() => Promise.resolve(json(image)));

    await expect(client.microvms.images.waitUntilReady('img-9', { timeout: 0, interval: 10 })).rejects.toBeInstanceOf(
      MicroVmTimeoutError
    );
  });
});

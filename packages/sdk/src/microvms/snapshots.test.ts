import { afterEach, describe, expect, it, vi } from 'vitest';
import { MicroVmNotFoundError, MicroVmStartError, MicroVmTimeoutError } from './errors';
import { MicroVM } from './microvm';
import { apiError, commandInfo, exit, json, out, request, setup, sseResponse, vmInfo } from './test-utils';
import type { MicroVmSnapshot } from './types';

const snapshot = (overrides: Partial<MicroVmSnapshot> = {}): MicroVmSnapshot => ({
  id: 'snap-1',
  name: 'after-install',
  applicationId: 'app-1',
  organizationId: 'org-1',
  sourceMicrovmId: 'vm-1',
  status: 'ready',
  image: { id: 'img-1', name: 'node22' },
  vcpus: 1,
  memoryMb: 2048,
  diskMb: 10240,
  sizeBytes: 1_000_000,
  error: null,
  expiresAt: '2026-12-01T12:00:00.000Z',
  createdAt: '2026-11-01T12:00:00.000Z',
  readyAt: '2026-11-01T12:00:05.000Z',
  ...overrides,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('client.microvms pause, resume and snapshot', () => {
  it('pauses and passes wait through', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(json(vmInfo({ status: 'pausing' }), 202));

    await expect(client.microvms.pause('vm-1', { wait: false })).resolves.toMatchObject({ status: 'pausing' });

    expect(request(fetch).method).toBe('POST');
    expect(request(fetch).path).toBe('/microvms/vm-1/pause');
    expect(request(fetch).query).toEqual({ wait: 'false' });
  });

  it('resumes without a wait query by default', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(json(vmInfo({ status: 'running' })));

    await expect(client.microvms.resume('vm-1')).resolves.toMatchObject({ status: 'running' });

    expect(request(fetch).path).toBe('/microvms/vm-1/resume');
    expect(request(fetch).query).toEqual({});
  });

  it('takes a snapshot with a name and expiry, answered 201 or 202', async () => {
    const { fetch, client } = setup();
    fetch
      .mockResolvedValueOnce(json(snapshot(), 201))
      .mockResolvedValueOnce(json(snapshot({ status: 'creating', sizeBytes: null, readyAt: null }), 202));

    await expect(client.microvms.snapshot('vm-1', { name: 'after-install', expiresInMs: 3_600_000 })).resolves.toEqual(
      snapshot()
    );
    await expect(client.microvms.snapshot('vm-1', {}, { wait: false })).resolves.toMatchObject({ status: 'creating' });

    expect(request(fetch, 0).path).toBe('/microvms/vm-1/snapshots');
    expect(request(fetch, 0).json).toEqual({ name: 'after-install', expiresInMs: 3_600_000 });
    expect(request(fetch, 1).query).toEqual({ wait: 'false' });
  });

  it('maps a missing microVM to a typed error', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(apiError(404, 'microVM not found', 'not_found'));

    await expect(client.microvms.pause('vm-404')).rejects.toBeInstanceOf(MicroVmNotFoundError);
  });
});

describe('client.microvms.waitUntilSettled', () => {
  it('polls through transitional statuses and reports each poll', async () => {
    const { fetch, client } = setup();
    fetch
      .mockResolvedValueOnce(json(vmInfo({ status: 'pending' })))
      .mockResolvedValueOnce(json(vmInfo({ status: 'starting' })))
      .mockResolvedValueOnce(json(vmInfo({ status: 'running' })));
    const seen: string[] = [];

    const vm = await client.microvms.waitUntilSettled('vm-1', {
      interval: 1,
      onPoll: (current, elapsedMs) => {
        expect(elapsedMs).toBeGreaterThanOrEqual(0);
        seen.push(current.status);
      },
    });

    expect(vm.status).toBe('running');
    expect(seen).toEqual(['pending', 'starting', 'running']);
  });

  it('returns a failed or paused microVM instead of throwing, so the caller decides', async () => {
    const { fetch, client } = setup();
    fetch
      .mockResolvedValueOnce(json(vmInfo({ status: 'pausing' })))
      .mockResolvedValueOnce(json(vmInfo({ status: 'paused' })))
      .mockResolvedValueOnce(json(vmInfo({ status: 'failed', stopReason: 'host_lost' })));

    await expect(client.microvms.waitUntilSettled('vm-1', { interval: 1 })).resolves.toMatchObject({
      status: 'paused',
    });
    await expect(client.microvms.waitUntilSettled('vm-1', { interval: 1 })).resolves.toMatchObject({
      status: 'failed',
      stopReason: 'host_lost',
    });
  });

  it('gives up when a poll stalls past the timeout', async () => {
    const { fetch, client } = setup();
    fetch.mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        })
    );

    await expect(client.microvms.waitUntilSettled('vm-1', { timeout: 20 })).rejects.toBeInstanceOf(MicroVmTimeoutError);
  });

  it('polls until the deadline instead of giving up one interval early', async () => {
    const { fetch, client } = setup();
    fetch
      .mockResolvedValueOnce(json(vmInfo({ status: 'pending' })))
      .mockResolvedValueOnce(json(vmInfo({ status: 'running' })));

    await expect(client.microvms.waitUntilSettled('vm-1', { timeout: 1_000, interval: 60_000 })).resolves.toMatchObject(
      { status: 'running' }
    );
  });

  it('gives up after the timeout', async () => {
    const { fetch, client } = setup();
    fetch.mockImplementation(() => Promise.resolve(json(vmInfo({ status: 'pending' }))));

    await expect(client.microvms.waitUntilSettled('vm-1', { timeout: 5, interval: 10 })).rejects.toBeInstanceOf(
      MicroVmTimeoutError
    );
  });
});

describe('client.microvms.snapshots', () => {
  it('lists one page for the default application and follows pages with listAll', async () => {
    const { fetch, client } = setup({ applicationId: 'app-1' });
    fetch
      .mockResolvedValueOnce(json({ data: [snapshot()], pagination: { nextCursor: 'c1', hasMore: true } }))
      .mockResolvedValueOnce(
        json({ data: [snapshot({ id: 'snap-2' })], pagination: { nextCursor: null, hasMore: false } })
      );

    const ids: string[] = [];
    for await (const entry of client.microvms.snapshots.listAll({ limit: 1 })) ids.push(entry.id);

    expect(ids).toEqual(['snap-1', 'snap-2']);
    expect(request(fetch, 0).path).toBe('/microvm-snapshots');
    expect(request(fetch, 0).query).toEqual({ applicationId: 'app-1', limit: '1' });
    expect(request(fetch, 1).query).toEqual({ applicationId: 'app-1', limit: '1', cursor: 'c1' });
  });

  it('reports no next page when hasMore is false', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(json({ data: [], pagination: { nextCursor: 'c1', hasMore: false } }));

    await expect(client.microvms.snapshots.list({ applicationId: 'app-2' })).resolves.toEqual({
      items: [],
      hasMore: false,
    });
  });

  it('gets and deletes a snapshot', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(json(snapshot())).mockResolvedValueOnce(json(null, 204));

    await expect(client.microvms.snapshots.get('snap-1')).resolves.toEqual(snapshot());
    await client.microvms.snapshots.delete('snap-1');

    expect(request(fetch, 0).path).toBe('/microvm-snapshots/snap-1');
    expect(request(fetch, 1).method).toBe('DELETE');
    expect(request(fetch, 1).path).toBe('/microvm-snapshots/snap-1');
  });

  it('waits until a snapshot is ready or failed', async () => {
    const { fetch, client } = setup();
    fetch
      .mockResolvedValueOnce(json(snapshot({ status: 'creating' })))
      .mockResolvedValueOnce(json(snapshot({ status: 'failed', error: 'capture failed' })));

    await expect(client.microvms.snapshots.waitUntilSettled('snap-1', { interval: 1 })).resolves.toMatchObject({
      status: 'failed',
      error: 'capture failed',
    });
  });

  it('creates a microVM from a snapshot', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(json(vmInfo(), 201));

    await client.microvms.create({ snapshotId: 'snap-1' });

    expect(request(fetch).json).toEqual({ snapshotId: 'snap-1' });
  });
});

describe('a synchronous run the API answered 202', () => {
  const running = commandInfo({ id: 'cmd_slow', cmd: 'sleep', args: ['60'] });
  const exited = commandInfo({
    id: 'cmd_slow',
    status: 'exited',
    exitCode: 3,
    startedAt: '2026-10-23T12:00:00.000Z',
    finishedAt: '2026-10-23T12:01:10.000Z',
  });

  it('keeps waiting in 45-second slices, then returns the exit code and the output from the log', async () => {
    const { fetch, client } = setup();
    fetch
      .mockResolvedValueOnce(json(running, 202))
      .mockResolvedValueOnce(json(running))
      .mockResolvedValueOnce(json(exited))
      .mockResolvedValueOnce(
        sseResponse([out('stdout', 'hello ', 0), out('stderr', 'warn', 0), out('stdout', 'world', 6), exit(3)])
      );

    const result = await client.microvms.commands.run('vm-1', { cmd: 'sleep', args: ['60'] });

    expect(result).toEqual({
      id: 'cmd_slow',
      exitCode: 3,
      signal: null,
      timedOut: false,
      stdout: 'hello world',
      stderr: 'warn',
      truncated: false,
      durationMs: 70_000,
    });
    expect(request(fetch, 1).path).toBe('/microvms/vm-1/commands/cmd_slow/wait');
    expect(request(fetch, 1).json).toEqual({ timeoutMs: 45_000 });
    expect(request(fetch, 2).path).toBe('/microvms/vm-1/commands/cmd_slow/wait');
    expect(request(fetch, 3).path).toBe('/microvms/vm-1/commands/cmd_slow/logs');
    expect(request(fetch, 3).query).toMatchObject({ follow: 'false' });
  });

  it('gives vm.run the final result too', async () => {
    const { fetch, client } = setup();
    fetch
      .mockResolvedValueOnce(json(vmInfo()))
      .mockResolvedValueOnce(json(running, 202))
      .mockResolvedValueOnce(json(exited))
      .mockResolvedValueOnce(sseResponse([out('stdout', 'done', 0), exit(3)]));

    const vm = await MicroVM.get('vm-1', { client });
    const result = await vm.run('sleep 60');

    expect(result).toMatchObject({ exitCode: 3, stdout: 'done', commandId: 'cmd_slow' });
  });

  it('returns a result that arrived in time as is', async () => {
    const { fetch, client } = setup();
    const answer = {
      id: 'cmd_fast',
      exitCode: 0,
      signal: null,
      timedOut: false,
      stdout: 'ok',
      stderr: '',
      truncated: false,
      durationMs: 5,
    };
    fetch.mockResolvedValueOnce(json(answer));

    await expect(client.microvms.commands.run('vm-1', { cmd: 'true' })).resolves.toEqual(answer);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('MicroVM pause, resume and snapshot', () => {
  it('pauses through a 202 and polls until paused', async () => {
    const { fetch, client } = setup();
    fetch
      .mockResolvedValueOnce(json(vmInfo()))
      .mockResolvedValueOnce(json(vmInfo({ status: 'pausing' }), 202))
      .mockResolvedValueOnce(json(vmInfo({ status: 'paused' })));

    const vm = await MicroVM.get('vm-1', { client });
    await vm.pause();

    expect(vm.status).toBe('paused');
    expect(request(fetch, 1).query).toEqual({ wait: 'false' });
  });

  it('resumes through a 202 and fails when the microVM stays paused', async () => {
    const { fetch, client } = setup();
    fetch
      .mockResolvedValueOnce(json(vmInfo({ status: 'paused' })))
      .mockResolvedValueOnce(json(vmInfo({ status: 'resuming' }), 202))
      .mockResolvedValueOnce(json(vmInfo({ status: 'running' })))
      .mockResolvedValueOnce(json(vmInfo({ status: 'resuming' }), 202))
      .mockResolvedValueOnce(json(vmInfo({ status: 'paused' })));

    const vm = await MicroVM.get('vm-1', { client });
    await vm.resume();
    expect(vm.status).toBe('running');
    await expect(vm.resume()).rejects.toBeInstanceOf(MicroVmStartError);
  });

  it('snapshots through a 202 and waits until the snapshot is ready', async () => {
    const { fetch, client } = setup();
    fetch
      .mockResolvedValueOnce(json(vmInfo()))
      .mockResolvedValueOnce(json(snapshot({ status: 'creating' }), 202))
      .mockResolvedValueOnce(json(snapshot()));

    const vm = await MicroVM.get('vm-1', { client });

    await expect(vm.snapshot({ name: 'after-install' })).resolves.toMatchObject({ status: 'ready' });
    expect(request(fetch, 2).path).toBe('/microvm-snapshots/snap-1');
  });

  it('throws when the snapshot failed', async () => {
    const { fetch, client } = setup();
    fetch
      .mockResolvedValueOnce(json(vmInfo()))
      .mockResolvedValueOnce(json(snapshot({ status: 'failed', error: 'capture failed' }), 202));

    const vm = await MicroVM.get('vm-1', { client });

    await expect(vm.snapshot()).rejects.toThrow('capture failed');
  });
});

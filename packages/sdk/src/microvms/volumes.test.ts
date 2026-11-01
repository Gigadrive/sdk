import { afterEach, describe, expect, it, vi } from 'vitest';
import { MicroVmTimeoutError } from './errors';
import { MicroVM } from './microvm';
import { json, request, setup, vmInfo } from './test-utils';
import type { MicroVmVolume } from './types';

const volume: MicroVmVolume = {
  id: 'vol-1',
  name: 'cache',
  applicationId: 'app-1',
  organizationId: 'org-1',
  sizeMb: 20480,
  storedBytes: null,
  status: 'available',
  attachedMicrovmId: null,
  lastSavedAt: null,
  lastSaveError: null,
  createdAt: '2026-11-01T12:00:00.000Z',
  updatedAt: '2026-11-01T12:00:00.000Z',
};

describe('client.microvms.volumes', () => {
  it('creates a volume for the default application', async () => {
    const { fetch, client } = setup({ applicationId: 'app-1' });
    fetch.mockResolvedValueOnce(json(volume, 201));

    await expect(client.microvms.volumes.create({ name: 'cache', sizeMb: 20480 })).resolves.toEqual(volume);

    expect(request(fetch).method).toBe('POST');
    expect(request(fetch).path).toBe('/microvm-volumes');
    expect(request(fetch).json).toEqual({ applicationId: 'app-1', name: 'cache', sizeMb: 20480 });
  });

  it('follows every page when listing', async () => {
    const { fetch, client } = setup();
    fetch
      .mockResolvedValueOnce(json({ data: [volume], pagination: { nextCursor: 'c1', hasMore: true } }))
      .mockResolvedValueOnce(
        json({ data: [{ ...volume, id: 'vol-2' }], pagination: { nextCursor: null, hasMore: false } })
      );

    const volumes = await client.microvms.volumes.list({ applicationId: 'app-2' });

    expect(volumes.map((entry) => entry.id)).toEqual(['vol-1', 'vol-2']);
    expect(request(fetch, 0).query).toEqual({ applicationId: 'app-2' });
    expect(request(fetch, 1).query).toEqual({ applicationId: 'app-2', cursor: 'c1' });
  });

  it('gets, renames and deletes', async () => {
    const { fetch, client } = setup();
    fetch
      .mockResolvedValueOnce(json(volume))
      .mockResolvedValueOnce(json({ ...volume, name: 'deps' }))
      .mockResolvedValueOnce(json(null, 204));

    await client.microvms.volumes.get('vol-1');
    await expect(client.microvms.volumes.rename('vol-1', 'deps')).resolves.toMatchObject({ name: 'deps' });
    await client.microvms.volumes.delete('vol-1');

    expect(request(fetch, 0).path).toBe('/microvm-volumes/vol-1');
    expect(request(fetch, 1).method).toBe('PATCH');
    expect(request(fetch, 1).json).toEqual({ name: 'deps' });
    expect(request(fetch, 2).method).toBe('DELETE');
  });
});

describe('MicroVM with volumes', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('attaches volumes at create', async () => {
    const { fetch, client } = setup();
    const volumes = [{ volumeId: 'vol-1', mountPath: '/cache' }];
    fetch.mockResolvedValueOnce(json(vmInfo({ volumes }), 201));

    const vm = await MicroVM.create({ client, volumes });

    expect(request(fetch).json).toMatchObject({ volumes });
    expect(vm.info.volumes).toEqual(volumes);
  });

  it('saves volumes without stopping', async () => {
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(json(vmInfo(), 201));
    const vm = await MicroVM.create({ client });
    fetch.mockReset();
    fetch.mockResolvedValueOnce(json(vmInfo({ status: 'running' })));

    await vm.saveVolumes();

    expect(request(fetch).method).toBe('POST');
    expect(request(fetch).path).toBe(`/microvms/${vm.id}/volumes/save`);
  });

  it('waits on stop until the volumes are saved', async () => {
    vi.useFakeTimers();
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(json(vmInfo(), 201));
    const vm = await MicroVM.create({ client });
    fetch.mockReset();
    fetch
      .mockResolvedValueOnce(json(vmInfo({ status: 'stopping' })))
      .mockResolvedValueOnce(json(vmInfo({ status: 'stopping' })))
      .mockResolvedValueOnce(json(vmInfo({ status: 'stopped', stopReason: 'user' })));

    const stopped = vm.stop();
    await vi.advanceTimersByTimeAsync(2000);

    await expect(stopped).resolves.toMatchObject({ status: 'stopped' });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(request(fetch, 1).method).toBe('GET');
  });

  it('gives up waiting on a save after the timeout', async () => {
    vi.useFakeTimers();
    const { fetch, client } = setup();
    fetch.mockResolvedValueOnce(json(vmInfo(), 201));
    const vm = await MicroVM.create({ client });
    fetch.mockReset();
    fetch.mockImplementation(() => Promise.resolve(json(vmInfo({ status: 'stopping' }))));

    const stopped = vm.stop({ timeout: '3s' });
    const assertion = expect(stopped).rejects.toBeInstanceOf(MicroVmTimeoutError);
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });
});

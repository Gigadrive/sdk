import type { MicroVmImage, MicroVmInfo } from '@gigadrive/sdk';
import { describe, expect, it, vi } from 'vitest';
import {
  concatBytes,
  describeMicroVm,
  exitStatusOf,
  formatBytes,
  formatImageTable,
  formatMicroVmTable,
  parseCopyTarget,
  parseKeyValues,
  posixBasename,
  posixJoin,
  relativeTime,
  relativeTo,
  StdinBatcher,
} from './microvm';

const NOW = Date.parse('2026-10-23T12:00:00.000Z');

const vm = (overrides: Partial<MicroVmInfo> = {}): MicroVmInfo => ({
  id: 'vm-1',
  slug: 'abc',
  applicationId: 'app-1',
  organizationId: 'org-1',
  status: 'running',
  image: { id: 'img', name: 'node22' },
  vcpus: 2,
  memoryMb: 2048,
  diskMb: 10240,
  region: 'fr-par',
  ports: [{ port: 3000, url: 'https://3000-abc.vm.gigadrive.app' }],
  network: { egress: 'allow' },
  metadata: {},
  timeoutMs: 300_000,
  expiresAt: '2026-10-23T12:05:00.000Z',
  createdAt: '2026-10-23T11:58:00.000Z',
  startedAt: '2026-10-23T11:58:01.000Z',
  stoppedAt: null,
  stopReason: null,
  ...overrides,
});

describe('parseCopyTarget', () => {
  it('parses remote targets', () => {
    expect(parseCopyTarget('vm:vm-1:/app/a.txt')).toEqual({ kind: 'remote', microvmId: 'vm-1', path: '/app/a.txt' });
    expect(parseCopyTarget('vm:vm-1:')).toEqual({ kind: 'remote', microvmId: 'vm-1', path: '.' });
    expect(parseCopyTarget('vm:vm-1:a:b')).toEqual({ kind: 'remote', microvmId: 'vm-1', path: 'a:b' });
  });

  it('treats everything else as local', () => {
    expect(parseCopyTarget('./dist')).toEqual({ kind: 'local', path: './dist' });
    expect(parseCopyTarget('C:\\work')).toEqual({ kind: 'local', path: 'C:\\work' });
  });

  it('describes malformed input', () => {
    expect(parseCopyTarget('vm:')).toMatch(/vm:<id>:<path>/);
    expect(parseCopyTarget('vm::/a')).toMatch(/vm:<id>:<path>/);
    expect(parseCopyTarget('vm:abc')).toMatch(/vm:<id>:<path>/);
    expect(parseCopyTarget('')).toBe('The path is empty.');
  });
});

describe('POSIX path helpers', () => {
  it('basename, join and relative paths', () => {
    expect(posixBasename('/app/dist/')).toBe('dist');
    expect(posixBasename('file')).toBe('file');
    expect(posixJoin('/app/', '/x', 'y')).toBe('/app/x/y');
    expect(posixJoin('', 'a')).toBe('a');
    expect(relativeTo('/app', '/app/src/a.ts')).toBe('src/a.ts');
    expect(relativeTo('/app/', '/app/b')).toBe('b');
    expect(relativeTo('/app', '/other/c')).toBe('c');
  });
});

describe('parseKeyValues', () => {
  it('parses KEY=VALUE pairs, keeping "=" in values', () => {
    expect(parseKeyValues(['A=1', 'B=x=y', 'C='])).toEqual({ ok: true, value: { A: '1', B: 'x=y', C: '' } });
    expect(parseKeyValues([])).toEqual({ ok: true, value: {} });
  });

  it('reports the first malformed entry', () => {
    expect(parseKeyValues(['A=1', 'nope', '=x'])).toEqual({ ok: false, entry: 'nope' });
    expect(parseKeyValues(['=x'])).toEqual({ ok: false, entry: '=x' });
  });
});

describe('exitStatusOf', () => {
  it('uses the exit code, or 128 + signal number', () => {
    expect(exitStatusOf({ exitCode: 0, signal: null })).toBe(0);
    expect(exitStatusOf({ exitCode: 42, signal: null })).toBe(42);
    expect(exitStatusOf({ exitCode: null, signal: 'SIGKILL' })).toBe(137);
    expect(exitStatusOf({ exitCode: null, signal: 'SIGINT' })).toBe(130);
    expect(exitStatusOf({ exitCode: null, signal: 'SIGWEIRD' })).toBe(128);
    expect(exitStatusOf({ exitCode: null, signal: null })).toBe(1);
  });
});

describe('formatting', () => {
  it('formats relative times', () => {
    expect(relativeTime('2026-10-23T12:00:30.000Z', NOW)).toBe('in 30s');
    expect(relativeTime('2026-10-23T11:55:00.000Z', NOW)).toBe('5m ago');
    expect(relativeTime('2026-10-23T15:00:00.000Z', NOW)).toBe('in 3h');
    expect(relativeTime('2026-10-20T12:00:00.000Z', NOW)).toBe('3d ago');
    expect(relativeTime(null, NOW)).toBe('-');
    expect(relativeTime('garbage', NOW)).toBe('garbage');
  });

  it('formats the microVM table', () => {
    const lines = formatMicroVmTable(
      [vm(), vm({ id: 'vm-22', status: 'stopped', ports: [], memoryMb: 512, image: { id: 'i', name: 'python3.13' } })],
      NOW
    );

    expect(lines).toEqual([
      'ID     STATUS   IMAGE       SIZE             PORTS  CREATED  EXPIRES',
      'vm-1   running  node22      2 vCPU, 2 GiB    3000   2m ago   in 5m',
      'vm-22  stopped  python3.13  2 vCPU, 512 MiB  -      2m ago   -',
    ]);
  });

  it('describes a microVM', () => {
    const lines = describeMicroVm(vm({ metadata: { team: 'ai' }, network: { egress: 'deny' } }), NOW);

    expect(lines).toContain('Status:      running');
    expect(lines).toContain('Size:        2 vCPU, 2 GiB memory, 10 GiB disk');
    expect(lines).toContain('Network:     outbound traffic blocked');
    expect(lines).toContain('Previews:    public');
    expect(lines).toContain('Expires:     2026-10-23T12:05:00.000Z (in 5m)');
    expect(lines).toContain('Metadata:    team=ai');
    expect(lines).toContain('  3000  https://3000-abc.vm.gigadrive.app');
  });

  it('names the networks an egress allowlist reaches', () => {
    const lines = describeMicroVm(vm({ network: { egress: 'allow', allow: ['140.82.112.0/20'] } }), NOW);

    expect(lines).toContain('Network:     only 140.82.112.0/20 (and DNS)');
  });

  it('says when preview URLs need the preview token', () => {
    const lines = describeMicroVm(vm({ network: { egress: 'allow', previews: 'private' } }), NOW);

    expect(lines).toContain('Previews:    private (preview token required)');
  });

  it('shows the stop reason and no expiry for a stopped microVM', () => {
    const lines = describeMicroVm(
      vm({ status: 'stopped', stopReason: 'timeout', stoppedAt: '2026-10-23T12:05:00.000Z' }),
      NOW
    );

    expect(lines).toContain('Status:      stopped (timeout)');
    expect(lines).toContain('Stopped:     2026-10-23T12:05:00.000Z');
    expect(lines.some((line) => line.startsWith('Expires:'))).toBe(false);
  });

  it('formats the image table', () => {
    const images: MicroVmImage[] = [
      { id: 'b1', name: 'node22', builtin: true, status: 'ready', applicationId: null, organizationId: null },
      {
        id: 'c1',
        name: 'py-ml',
        builtin: false,
        status: 'building',
        applicationId: 'a',
        organizationId: 'o',
        source: { type: 'registry', ref: 'python:3.13' },
      },
      {
        id: 'c2',
        name: 'tool',
        builtin: false,
        status: 'failed',
        applicationId: 'a',
        organizationId: 'o',
        source: { type: 'dockerfile', dockerfile: 'FROM x' },
      },
    ];

    expect(formatImageTable(images)).toEqual([
      'NAME    STATUS    SOURCE       ID',
      'node22  ready     built-in     b1',
      'py-ml   building  python:3.13  c1',
      'tool    failed    Dockerfile   c2',
    ]);
  });

  it('formats bytes', () => {
    expect(formatBytes(12)).toBe('12 B');
    expect(formatBytes(3_500)).toBe('3.4 KiB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MiB');
  });
});

describe('concatBytes', () => {
  it('joins chunks and returns a single chunk as is', () => {
    const one = new Uint8Array([1]);
    expect(concatBytes([one])).toBe(one);
    expect(concatBytes([new Uint8Array([1, 2]), new Uint8Array([3])])).toEqual(new Uint8Array([1, 2, 3]));
  });
});

describe('StdinBatcher', () => {
  const bytes = (text: string) => new TextEncoder().encode(text);
  const text = (data: Uint8Array) => new TextDecoder().decode(data);

  it('gathers keystrokes typed within the delay into one request', async () => {
    vi.useFakeTimers();
    try {
      const sent: string[] = [];
      const batcher = new StdinBatcher(async (data) => void sent.push(text(data)), { delayMs: 10 });

      batcher.push(bytes('l'));
      batcher.push(bytes('s'));
      await vi.advanceTimersByTimeAsync(10);
      batcher.push(bytes('\r'));
      await vi.advanceTimersByTimeAsync(10);

      expect(sent).toEqual(['ls', '\r']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends at once when maxBytes is reached', async () => {
    vi.useFakeTimers();
    try {
      const sent: string[] = [];
      const batcher = new StdinBatcher(async (data) => void sent.push(text(data)), { delayMs: 1_000, maxBytes: 4 });

      batcher.push(bytes('abcd'));
      await vi.advanceTimersByTimeAsync(0);

      expect(sent).toEqual(['abcd']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps one request in flight and sends what queued meanwhile as one, in order', async () => {
    const sent: string[] = [];
    let release: () => void = () => undefined;
    let first = true;
    const send = vi.fn(async (data: Uint8Array) => {
      sent.push(text(data));
      if (first) {
        first = false;
        await new Promise<void>((resolve) => (release = resolve));
      }
    });
    const batcher = new StdinBatcher(send, { delayMs: 1 });

    batcher.push(bytes('a'));
    const flushing = batcher.flush();
    batcher.push(bytes('b'));
    batcher.push(bytes('c'));
    const second = batcher.flush();
    expect(send).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([flushing, second]);

    expect(sent).toEqual(['a', 'bc']);
  });

  it('reports send failures and keeps going', async () => {
    const errors: unknown[] = [];
    const sent: string[] = [];
    let fail = true;
    const batcher = new StdinBatcher(
      async (data) => {
        if (fail) {
          fail = false;
          throw new Error('boom');
        }
        sent.push(text(data));
      },
      { onError: (error) => errors.push(error) }
    );

    batcher.push(bytes('x'));
    await batcher.flush();
    batcher.push(bytes('y'));
    await batcher.close();

    expect(errors).toHaveLength(1);
    expect(sent).toEqual(['y']);
  });

  it('ignores input after close and empty chunks', async () => {
    const send = vi.fn(async () => undefined);
    const batcher = new StdinBatcher(send);

    batcher.push(new Uint8Array(0));
    await batcher.close();
    batcher.push(bytes('late'));
    await batcher.flush();

    expect(send).not.toHaveBeenCalled();
  });
});

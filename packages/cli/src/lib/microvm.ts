import type { CommandInfo, MicroVmImage, MicroVmInfo } from '@gigadrive/sdk';

/**
 * Pure helpers for the `gigadrive microvms` commands: argument parsing,
 * output formatting, exit codes and stdin batching.
 */

// ---------------------------------------------------------------------------
// `cp` targets
// ---------------------------------------------------------------------------

/** One side of `gigadrive microvms cp`. */
export type CopyTarget =
  | { readonly kind: 'local'; readonly path: string }
  | { readonly kind: 'remote'; readonly microvmId: string; readonly path: string };

const REMOTE_PREFIX = 'vm:';

/**
 * Parses a `cp` argument: `vm:<id>:<path>` is a path inside a microVM,
 * anything else is a local path. An empty remote path means the home
 * directory.
 *
 * @returns The target, or a string describing what is wrong.
 */
export const parseCopyTarget = (value: string): CopyTarget | string => {
  if (!value.startsWith(REMOTE_PREFIX)) {
    return value.length === 0 ? 'The path is empty.' : { kind: 'local', path: value };
  }
  const rest = value.slice(REMOTE_PREFIX.length);
  const separator = rest.indexOf(':');
  if (separator <= 0) return `"${value}" is not in the form vm:<id>:<path>.`;
  const microvmId = rest.slice(0, separator);
  const path = rest.slice(separator + 1);
  return { kind: 'remote', microvmId, path: path.length === 0 ? '.' : path };
};

/** Last segment of a POSIX path, ignoring trailing slashes. */
export const posixBasename = (path: string): string => {
  const trimmed = path.replace(/\/+$/, '');
  const index = trimmed.lastIndexOf('/');
  return index === -1 ? trimmed : trimmed.slice(index + 1);
};

/** Joins POSIX path segments with single slashes. */
export const posixJoin = (...segments: string[]): string =>
  segments
    .filter((segment) => segment.length > 0)
    .join('/')
    .replace(/\/{2,}/g, '/');

/** Path of `entry` below `root`, both as reported by the microVM. */
export const relativeTo = (root: string, entry: string): string => {
  const base = root.replace(/\/+$/, '');
  return entry.startsWith(`${base}/`) ? entry.slice(base.length + 1) : posixBasename(entry);
};

// ---------------------------------------------------------------------------
// Option parsing
// ---------------------------------------------------------------------------

/**
 * Parses repeated `KEY=VALUE` flags into a record.
 *
 * @returns The record, or the first malformed entry.
 */
export const parseKeyValues = (
  entries: ReadonlyArray<string>
): { readonly ok: true; readonly value: Record<string, string> } | { readonly ok: false; readonly entry: string } => {
  const value: Record<string, string> = {};
  for (const entry of entries) {
    const index = entry.indexOf('=');
    if (index <= 0) return { ok: false, entry };
    value[entry.slice(0, index)] = entry.slice(index + 1);
  }
  return { ok: true, value };
};

// ---------------------------------------------------------------------------
// Exit codes
// ---------------------------------------------------------------------------

const SIGNAL_NUMBERS: Record<string, number> = {
  SIGHUP: 1,
  SIGINT: 2,
  SIGQUIT: 3,
  SIGABRT: 6,
  SIGKILL: 9,
  SIGUSR1: 10,
  SIGSEGV: 11,
  SIGUSR2: 12,
  SIGPIPE: 13,
  SIGTERM: 15,
};

/**
 * The local exit status for a finished remote command: its exit code, or
 * `128 + n` for a command killed by signal `n`, like a shell reports it.
 */
export const exitStatusOf = (command: Pick<CommandInfo, 'exitCode' | 'signal'>): number => {
  if (command.exitCode !== null) return command.exitCode;
  if (command.signal) return 128 + (SIGNAL_NUMBERS[command.signal] ?? 0);
  return 1;
};

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const formatMemory = (mb: number) => (mb % 1024 === 0 ? `${mb / 1024} GiB` : `${mb} MiB`);

/** A human-readable relative time such as `in 4m` or `3h ago`. */
export const relativeTime = (iso: string | null, now = Date.now()): string => {
  if (!iso) return '-';
  const delta = Date.parse(iso) - now;
  if (!Number.isFinite(delta)) return iso;
  const abs = Math.abs(delta);
  const text =
    abs < 60_000
      ? `${Math.round(abs / 1000)}s`
      : abs < 3_600_000
        ? `${Math.round(abs / 60_000)}m`
        : abs < 86_400_000
          ? `${Math.round(abs / 3_600_000)}h`
          : `${Math.round(abs / 86_400_000)}d`;
  return delta >= 0 ? `in ${text}` : `${text} ago`;
};

/** Pads columns of a table to their widest cell. */
export const formatTable = (rows: ReadonlyArray<ReadonlyArray<string>>): string[] => {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, index) => {
      widths[index] = Math.max(widths[index] ?? 0, cell.length);
    });
  }
  return rows.map((row) =>
    row
      .map((cell, index) => (index === row.length - 1 ? cell : cell.padEnd(widths[index] ?? 0)))
      .join('  ')
      .trimEnd()
  );
};

/** The `microvms ls` table, header included. */
export const formatMicroVmTable = (vms: ReadonlyArray<MicroVmInfo>, now = Date.now()): string[] =>
  formatTable([
    ['ID', 'STATUS', 'IMAGE', 'SIZE', 'PORTS', 'CREATED', 'EXPIRES'],
    ...vms.map((vm) => [
      vm.id,
      vm.status,
      vm.image.name,
      `${vm.vcpus} vCPU, ${formatMemory(vm.memoryMb)}`,
      vm.ports.map((entry) => entry.port).join(',') || '-',
      relativeTime(vm.createdAt, now),
      vm.status === 'running' || vm.status === 'starting' ? relativeTime(vm.expiresAt, now) : '-',
    ]),
  ]);

/** The lines `microvms get` and `microvms create` print. */
export const describeMicroVm = (vm: MicroVmInfo, now = Date.now()): string[] => {
  const lines = [
    `ID:          ${vm.id}`,
    `Status:      ${vm.status}${vm.stopReason ? ` (${vm.stopReason})` : ''}`,
    `Image:       ${vm.image.name}`,
    `Size:        ${vm.vcpus} vCPU, ${formatMemory(vm.memoryMb)} memory, ${formatMemory(vm.diskMb)} disk`,
    `Region:      ${vm.region}`,
    `Network:     ${
      vm.network.egress === 'deny'
        ? 'outbound traffic blocked'
        : vm.network.allow && vm.network.allow.length > 0
          ? `only ${vm.network.allow.join(', ')} (and DNS)`
          : 'internet access'
    }`,
    `Previews:    ${vm.network.previews === 'private' ? 'private (preview token required)' : 'public'}`,
    `Application: ${vm.applicationId}`,
    `Created:     ${vm.createdAt}`,
  ];
  if (vm.expiresAt && (vm.status === 'running' || vm.status === 'starting')) {
    lines.push(`Expires:     ${vm.expiresAt} (${relativeTime(vm.expiresAt, now)})`);
  }
  if (vm.stoppedAt) lines.push(`Stopped:     ${vm.stoppedAt}`);
  const metadata = Object.entries(vm.metadata);
  if (metadata.length > 0) lines.push(`Metadata:    ${metadata.map(([key, value]) => `${key}=${value}`).join(', ')}`);
  if (vm.ports.length > 0) {
    lines.push('Ports:');
    for (const entry of vm.ports) lines.push(`  ${entry.port}  ${entry.url}`);
  }
  return lines;
};

const imageSource = (image: MicroVmImage): string => {
  if (image.builtin) return 'built-in';
  const source = image.source;
  if (!source) return '-';
  return source.type === 'dockerfile' ? 'Dockerfile' : source.ref;
};

/** The `microvms images ls` table, header included. */
export const formatImageTable = (images: ReadonlyArray<MicroVmImage>): string[] =>
  formatTable([
    ['NAME', 'STATUS', 'SOURCE', 'ID'],
    ...images.map((image) => [image.name, image.status, imageSource(image), image.id]),
  ]);

/** Bytes as `12 B`, `3.4 KiB`, `5.0 MiB`. */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
};

// ---------------------------------------------------------------------------
// Stdin batching
// ---------------------------------------------------------------------------

/** Joins byte chunks into one array. */
export const concatBytes = (chunks: ReadonlyArray<Uint8Array>): Uint8Array => {
  if (chunks.length === 1) return chunks[0];
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
};

/** Tuning of a {@link StdinBatcher}. */
export interface StdinBatcherOptions {
  /** How long to gather keystrokes before sending them. Default 8 ms. */
  readonly delayMs?: number;
  /** Send at once when this many bytes are waiting. Default 64 KiB. */
  readonly maxBytes?: number;
  /** Called when a send fails; the batcher keeps going. */
  readonly onError?: (error: unknown) => void;
}

/**
 * Gathers stdin chunks (keystrokes, pasted text) and sends them in as few
 * requests as possible, one request at a time and in order. Typing sends a
 * request per short pause; a paste becomes a single request.
 */
export class StdinBatcher {
  private pending: Uint8Array[] = [];
  private pendingBytes = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: Promise<void> | undefined;
  private closed = false;
  private readonly delayMs: number;
  private readonly maxBytes: number;

  constructor(
    private readonly send: (data: Uint8Array) => Promise<void>,
    private readonly options: StdinBatcherOptions = {}
  ) {
    this.delayMs = options.delayMs ?? 8;
    this.maxBytes = options.maxBytes ?? 64 * 1024;
  }

  /** Queues a chunk. Ignored after {@link close}. */
  push(chunk: Uint8Array): void {
    if (this.closed || chunk.length === 0) return;
    this.pending.push(chunk);
    this.pendingBytes += chunk.length;
    if (this.pendingBytes >= this.maxBytes) this.schedule(0);
    else if (this.timer === undefined) this.schedule(this.delayMs);
  }

  /** Sends everything queued so far, after any request already in flight. */
  async flush(): Promise<void> {
    while (this.inFlight) await this.inFlight;
    if (this.pending.length === 0) return;
    const data = concatBytes(this.pending);
    this.pending = [];
    this.pendingBytes = 0;
    this.inFlight = this.send(data)
      .catch((error: unknown) => this.options.onError?.(error))
      .finally(() => {
        this.inFlight = undefined;
      });
    await this.inFlight;
  }

  /** Stops accepting chunks and sends what is left. */
  async close(): Promise<void> {
    this.closed = true;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    await this.flush();
  }

  private schedule(delay: number): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, delay);
  }
}

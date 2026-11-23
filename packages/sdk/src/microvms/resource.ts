import type { HttpClient } from '../http-client';
import { BaseResource } from '../resources/base-resource';
import { parseSSEEvents } from '../streaming';
import { commandDurationMs } from './command';
import { abortReason, durationToMs, type MicroVmDuration, sleep } from './duration';
import {
  MicroVmBusyError,
  MicroVmImageBuildError,
  MicroVmTimeoutError,
  MicroVmWatchInterruptedError,
  toMicroVmError,
} from './errors';
import { type CommandLogStreamOptions, streamCommandLogs } from './logs';
import type {
  CommandInfo,
  CommandLogEvent,
  CommandRunResult,
  CommandSignal,
  CreatedMicroVmInfo,
  CreateMicroVmImageInput,
  CreateMicroVmInput,
  CreateMicroVmSnapshotInput,
  CreateMicroVmVolumeInput,
  CreateMicroVmWebhookInput,
  FileEntry,
  FileListing,
  FileWriteResult,
  ListMicroVmSnapshotsQuery,
  ListMicroVmsQuery,
  MicroVmEgressPolicy,
  MicroVmFileChange,
  MicroVmFileChangeType,
  MicroVmImage,
  MicroVmImageSource,
  MicroVmInfo,
  MicroVmMetrics,
  MicroVmPage,
  MicroVmSnapshot,
  MicroVmSnapshotPage,
  MicroVmStatus,
  MicroVmVolume,
  MicroVmWebhook,
  MicroVmWebhookDelivery,
  MicroVmWebhookWithSecret,
  PtySize,
  StartCommandInput,
  UpdateMicroVmWebhookInput,
} from './types';

/** Content accepted by file writes: text (UTF-8), bytes, a `Blob`/`File`, or a web `ReadableStream`. */
export type MicroVmFileContent = string | Uint8Array | ArrayBuffer | Blob | ReadableStream<Uint8Array>;

/** Per-call request options. */
export interface MicroVmRequestOptions {
  /** Cancels the request. */
  signal?: AbortSignal;
}

/** Options of {@link MicroVmsResource.getMetrics}. */
export interface GetMicroVmMetricsOptions extends MicroVmRequestOptions {
  /** How far back the CPU series reaches, in minutes: 1 to 1440, default 15. */
  windowMinutes?: number;
}

/** Options of a lifecycle call that the API may answer before it finished (`202`). */
export interface MicroVmLifecycleOptions extends MicroVmRequestOptions {
  /**
   * `true` (the API default) asks the API to answer once the change finished,
   * which it does for up to two minutes before it answers `202` anyway.
   * `false` answers `202` at once. Either way, check the returned status and
   * follow up with {@link MicroVmsResource.waitUntilSettled}.
   */
  wait?: boolean;
}

/** Options of a settle wait: {@link MicroVmsResource.waitUntilSettled} and {@link MicroVmSnapshotsResource.waitUntilSettled}. */
export interface WaitUntilSettledOptions<T> extends MicroVmRequestOptions {
  /** Give up after this long. Default `'10m'`. */
  timeout?: MicroVmDuration;
  /** Pause between polls. Default `'1s'`. */
  interval?: MicroVmDuration;
  /** Called after every poll with the current state and the time waited so far, to report progress. */
  onPoll?: (current: T, elapsedMs: number) => void;
}

/**
 * microVM statuses that change on their own: a microVM in one of them is on
 * its way to another status. Every other status stays until someone acts.
 */
export const MICROVM_TRANSITIONAL_STATUSES: readonly MicroVmStatus[] = [
  'pending',
  'starting',
  'pausing',
  'resuming',
  'stopping',
];

/**
 * Polls `load` until `settled` holds, calling `onPoll` after every poll.
 *
 * @throws {@link MicroVmTimeoutError} with `describe(current)` when `timeout` passes first.
 */
const pollUntil = async <T>(
  load: (signal?: AbortSignal) => Promise<T>,
  settled: (current: T) => boolean,
  describe: (current: T) => string,
  options: WaitUntilSettledOptions<T>
): Promise<T> => {
  const started = Date.now();
  const deadline = started + durationToMs(options.timeout ?? '10m');
  const interval = durationToMs(options.interval ?? '1s');
  // Aborts a poll that stalls past the deadline (with a second of grace for
  // the last poll, sent at the deadline), as well as on the caller's signal.
  const controller = new AbortController();
  const timeoutReason = new Error('deadline');
  const timer = setTimeout(() => controller.abort(timeoutReason), Math.max(0, deadline - started) + 1_000);
  const forward = () => controller.abort(abortReason(options.signal));
  options.signal?.addEventListener('abort', forward, { once: true });
  let current: T | undefined;
  try {
    for (;;) {
      if (options.signal?.aborted) throw abortReason(options.signal);
      current = await load(controller.signal);
      options.onPoll?.(current, Date.now() - started);
      if (settled(current)) return current;
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      await sleep(Math.min(interval, remaining), options.signal);
    }
  } catch (error) {
    if (controller.signal.reason !== timeoutReason) throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', forward);
  }
  throw new MicroVmTimeoutError(
    current === undefined
      ? 'No answer before the wait timed out; gave up waiting.'
      : `${describe(current)}; gave up waiting.`
  );
};

const vmPath = (microvmId: string) => `/microvms/${encodeURIComponent(microvmId)}`;
const commandPath = (microvmId: string, commandId: string) =>
  `${vmPath(microvmId)}/commands/${encodeURIComponent(commandId)}`;

/** Re-types API errors of microVM routes (see {@link toMicroVmError}). */
const typed = <T>(promise: Promise<T>, filePath?: string): Promise<T> =>
  promise.catch((error: unknown) => {
    throw toMicroVmError(error, filePath);
  });

/** Pauses before each retry of a read the microVM answered `microvm_busy`. */
const BUSY_RETRY_DELAYS_MS = [250, 500, 1_000, 2_000, 4_000];

/**
 * Runs an idempotent request (a read, or a wait), retrying with backoff while
 * the microVM answers `microvm_busy` (429/503). Mutations are never retried.
 */
const read = async <T>(run: () => Promise<T>, signal?: AbortSignal, filePath?: string): Promise<T> => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await typed(run(), filePath);
    } catch (error) {
      if (!(error instanceof MicroVmBusyError) || attempt >= BUSY_RETRY_DELAYS_MS.length || signal?.aborted) {
        throw error;
      }
      await sleep(BUSY_RETRY_DELAYS_MS[attempt], signal);
    }
  }
};

/** Longest a single `POST .../wait` holds the request: the API answers within 45 seconds either way. */
const COMMAND_WAIT_SLICE_MS = 45_000;

/** Most output a run result carries per stream, like the synchronous answer. */
const RUN_OUTPUT_LIMIT_BYTES = 1024 * 1024;

/**
 * Whether a synchronous run was answered `202` with the still-running command
 * (it took longer than the API holds a request) instead of its result.
 */
const isStillRunning = (answer: unknown): answer is CommandInfo & { commandId?: string } => {
  const value = answer as { status?: unknown; stdout?: unknown } | null;
  return value !== null && typeof value === 'object' && value.status === 'running' && typeof value.stdout !== 'string';
};

/** Joins chunks and decodes them as UTF-8, keeping at most {@link RUN_OUTPUT_LIMIT_BYTES}. */
const decodeOutput = (chunks: Uint8Array[]): { text: string; truncated: boolean } => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new Uint8Array(Math.min(total, RUN_OUTPUT_LIMIT_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= bytes.length) break;
    const part = chunk.subarray(0, bytes.length - offset);
    bytes.set(part, offset);
    offset += part.length;
  }
  return { text: new TextDecoder().decode(bytes), truncated: total > RUN_OUTPUT_LIMIT_BYTES };
};

/** Accepts `{ data }`, `{ items }` or a bare array, since list routes differ in their envelope. */
const unwrapList = <T>(body: unknown, key: 'data' | 'entries' = 'data'): T[] => {
  if (Array.isArray(body)) return body as T[];
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const list = record[key] ?? record.data ?? record.items;
    if (Array.isArray(list)) return list as T[];
  }
  return [];
};

/** The guest reports `commandId`; the public API reports `id`. Accept both, and default `timedOut`. */
const normalizeCommand = (raw: CommandInfo & { commandId?: string }): CommandInfo => {
  const withId = raw.id === undefined && raw.commandId !== undefined ? { ...raw, id: raw.commandId } : raw;
  return typeof withId.timedOut === 'boolean' ? withId : { ...withId, timedOut: false };
};

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * Commands inside a microVM: `client.microvms.commands`. Every method maps to
 * one route of `/microvms/:id/commands`. For a friendlier API use
 * {@link MicroVM.run} and {@link MicroVM.spawn}.
 */
export class MicroVmCommandsResource extends BaseResource {
  /**
   * Run a command and wait for it to exit (`POST /microvms/:id/commands`, `wait: true`).
   *
   * @example
   * ```ts
   * const { exitCode, stdout } = await client.microvms.commands.run(id, { cmd: 'node', args: ['-v'] });
   * ```
   */
  async run(
    microvmId: string,
    input: StartCommandInput,
    options: MicroVmRequestOptions = {}
  ): Promise<CommandRunResult> {
    const answer = await typed(
      this.httpClient.post<CommandRunResult | (CommandInfo & { commandId?: string })>(
        `${vmPath(microvmId)}/commands`,
        { ...input, wait: true },
        options
      )
    );
    if (!isStillRunning(answer)) return answer;
    // The API answers `202` with the running command when it takes longer
    // than it holds a request (45 s). Keep waiting, then read the output.
    return this.collectRun(microvmId, normalizeCommand(answer), options.signal);
  }

  /**
   * Waits for a command a synchronous run answered `202` for, in slices of at
   * most 45 seconds, then reads its output from the log, so the caller gets
   * the same result as an answer that arrived in time.
   */
  private async collectRun(microvmId: string, command: CommandInfo, signal?: AbortSignal): Promise<CommandRunResult> {
    let current = command;
    while (current.status !== 'exited') {
      if (signal?.aborted) throw abortReason(signal);
      current = await this.wait(microvmId, command.id, { timeoutMs: COMMAND_WAIT_SLICE_MS, signal });
    }
    const chunks: Record<'stdout' | 'stderr', Uint8Array[]> = { stdout: [], stderr: [] };
    let dropped = false;
    for await (const event of this.logs(microvmId, command.id, { follow: false, signal })) {
      if (event.type === 'output') chunks[event.stream].push(event.data);
      else if (event.type === 'truncated') dropped = true;
    }
    const stdout = decodeOutput(chunks.stdout);
    const stderr = decodeOutput(chunks.stderr);
    return {
      id: command.id,
      exitCode: current.exitCode,
      signal: current.signal,
      timedOut: current.timedOut === true,
      stdout: stdout.text,
      stderr: stderr.text,
      truncated: dropped || stdout.truncated || stderr.truncated,
      durationMs: commandDurationMs(current) ?? 0,
    };
  }

  /**
   * Start a detached command and return at once (`POST /microvms/:id/commands`, `wait: false`).
   * Follow its output with {@link logs}.
   */
  async start(microvmId: string, input: StartCommandInput, options: MicroVmRequestOptions = {}): Promise<CommandInfo> {
    const raw = await typed(
      this.httpClient.post<CommandInfo>(`${vmPath(microvmId)}/commands`, { ...input, wait: false }, options)
    );
    return normalizeCommand(raw);
  }

  /** List the microVM's commands, newest first (`GET /microvms/:id/commands`). */
  async list(microvmId: string, options: MicroVmRequestOptions = {}): Promise<CommandInfo[]> {
    const body = await read(
      () => this.httpClient.get<unknown>(`${vmPath(microvmId)}/commands`, options),
      options.signal
    );
    return unwrapList<CommandInfo>(body).map(normalizeCommand);
  }

  /** Get one command (`GET /microvms/:id/commands/:cmdId`). */
  async get(microvmId: string, commandId: string, options: MicroVmRequestOptions = {}): Promise<CommandInfo> {
    return normalizeCommand(
      await read(() => this.httpClient.get<CommandInfo>(commandPath(microvmId, commandId), options), options.signal)
    );
  }

  /**
   * Stream a command's output (`GET /microvms/:id/commands/:cmdId/logs`, SSE).
   *
   * Yields `output` events with the raw bytes and a final `exit` event. A
   * dropped connection is reopened from the last received offsets, so no byte
   * is lost or repeated; pass `reconnect: false` to disable that.
   *
   * @example
   * ```ts
   * for await (const event of client.microvms.commands.logs(id, commandId)) {
   *   if (event.type === 'output') process.stdout.write(event.data);
   *   else console.log('exit', event.exitCode);
   * }
   * ```
   */
  logs(microvmId: string, commandId: string, options: CommandLogStreamOptions = {}): AsyncGenerator<CommandLogEvent> {
    return streamCommandLogs(
      ({ follow, stdoutOffset, stderrOffset, signal }) =>
        typed(
          this.httpClient.requestStream('GET', `${commandPath(microvmId, commandId)}/logs`, {
            query: { follow, stdoutOffset, stderrOffset },
            headers: { Accept: 'text/event-stream' },
            signal,
          })
        ),
      {
        ...options,
        resolveExit:
          options.resolveExit ??
          (async () => {
            const info = await this.get(microvmId, commandId);
            return info.status === 'exited' ? { exitCode: info.exitCode, signal: info.signal } : null;
          }),
      }
    );
  }

  /**
   * Wait up to `timeoutMs` (at most 60000) for the command to exit
   * (`POST /microvms/:id/commands/:cmdId/wait`). The returned command is still
   * `running` when the wait timed out.
   */
  async wait(
    microvmId: string,
    commandId: string,
    options: { timeoutMs?: number } & MicroVmRequestOptions = {}
  ): Promise<CommandInfo> {
    const { signal, timeoutMs } = options;
    const raw = await read(
      () =>
        this.httpClient.post<CommandInfo>(
          `${commandPath(microvmId, commandId)}/wait`,
          timeoutMs === undefined ? {} : { timeoutMs },
          { signal }
        ),
      signal
    );
    return normalizeCommand(raw);
  }

  /**
   * Write to the command's stdin (`POST /microvms/:id/commands/:cmdId/stdin`).
   * The command must have been started with `stdin: true` or a `pty`.
   *
   * @param options.eof - Close stdin after writing.
   */
  async stdin(
    microvmId: string,
    commandId: string,
    data: string | Uint8Array | ArrayBuffer | Blob,
    options: { eof?: boolean } & MicroVmRequestOptions = {}
  ): Promise<void> {
    await typed(
      this.httpClient.post<void>(`${commandPath(microvmId, commandId)}/stdin`, data, {
        headers: { 'Content-Type': 'application/octet-stream' },
        query: { eof: options.eof ? true : undefined },
        signal: options.signal,
      })
    );
  }

  /** Send a signal to the command's process group (`POST /microvms/:id/commands/:cmdId/signal`). */
  async signal(
    microvmId: string,
    commandId: string,
    signal: CommandSignal,
    options: MicroVmRequestOptions = {}
  ): Promise<void> {
    await typed(this.httpClient.post<void>(`${commandPath(microvmId, commandId)}/signal`, { signal }, options));
  }

  /** Resize a PTY command's terminal (`POST /microvms/:id/commands/:cmdId/resize`). */
  async resize(
    microvmId: string,
    commandId: string,
    size: PtySize,
    options: MicroVmRequestOptions = {}
  ): Promise<void> {
    await typed(
      this.httpClient.post<void>(
        `${commandPath(microvmId, commandId)}/resize`,
        { cols: size.cols, rows: size.rows },
        options
      )
    );
  }
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

/** Options of a directory watch. */
export interface WatchDirectoryOptions extends MicroVmRequestOptions {
  /** Also watch every subdirectory, including new ones, up to 8192 directories. Default `false`. */
  recursive?: boolean;
  /** Watch with this user's permissions instead of the image's user. */
  user?: string;
}

const FILE_CHANGE_TYPES: ReadonlySet<string> = new Set(['create', 'write', 'remove', 'rename', 'chmod', 'overflow']);

/** A `change` event's data, or `null` when it is not a change the SDK knows. */
const parseFileChange = (data: string): MicroVmFileChange | null => {
  try {
    const value: unknown = JSON.parse(data);
    if (value === null || typeof value !== 'object') return null;
    const { type, path, isDirectory } = value as Record<string, unknown>;
    if (typeof type !== 'string' || !FILE_CHANGE_TYPES.has(type) || typeof path !== 'string') return null;
    return { type: type as MicroVmFileChangeType, path, isDirectory: isDirectory === true };
  } catch {
    return null;
  }
};

/** Options of a file read. */
export interface ReadFileOptions extends MicroVmRequestOptions {
  /** Byte offset to start reading at. */
  offset?: number;
  /** Maximum number of bytes to read. */
  length?: number;
}

/** Options of a file write. */
export interface WriteFileOptions extends MicroVmRequestOptions {
  /** Permission bits, as an octal string (`'0755'`) or number (`0o755`). Default `0644`. */
  mode?: string | number;
  /** Create missing parent directories. Default `true`. */
  mkdirs?: boolean;
}

const modeString = (mode: string | number | undefined) =>
  typeof mode === 'number' ? mode.toString(8).padStart(4, '0') : mode;

/**
 * Files inside a microVM: `client.microvms.files`. Every method maps to one
 * route of `/microvms/:id/files`. `vm.files` on a {@link MicroVM} binds the id.
 * Relative paths resolve against the user's home directory.
 */
export class MicroVmFilesResource extends BaseResource {
  /**
   * Watch a directory (`GET /microvms/:id/files/watch`) and yield every change
   * until the directory is deleted or moved, or `signal` aborts. It does not
   * reconnect: changes made while no watch is connected are not replayed.
   *
   * @throws {@link MicroVmFileNotFoundError} when `path` does not exist.
   * @throws {@link MicroVmWatchUnsupportedError} for a microVM started before watching was available.
   * @throws {@link MicroVmWatchInterruptedError} when the watch fails partway, for example because the microVM stopped.
   */
  async *watch(
    microvmId: string,
    path: string,
    options: WatchDirectoryOptions = {}
  ): AsyncGenerator<MicroVmFileChange> {
    const response = await typed(
      this.httpClient.requestStream('GET', `${vmPath(microvmId)}/files/watch`, {
        query: { path, recursive: options.recursive === true ? true : undefined, user: options.user },
        headers: { Accept: 'text/event-stream' },
        signal: options.signal,
      }),
      path
    );
    try {
      for await (const event of parseSSEEvents(response)) {
        if (event.event === 'change') {
          const change = parseFileChange(event.data);
          if (change) yield change;
        } else if (event.event === 'end') {
          return;
        } else if (event.event === 'error') {
          throw new MicroVmWatchInterruptedError(microvmId);
        }
      }
    } catch (error) {
      // Stopping the watch is not a failure; a dropped connection is an interruption.
      if (options.signal?.aborted) return;
      throw error instanceof MicroVmWatchInterruptedError ? error : new MicroVmWatchInterruptedError(microvmId);
    }
    // The connection ended without `end`: the watch did not run to completion.
    if (!options.signal?.aborted) throw new MicroVmWatchInterruptedError(microvmId);
  }

  /** Read a file as bytes (`GET /microvms/:id/files/content`). */
  async read(microvmId: string, path: string, options: ReadFileOptions = {}): Promise<Uint8Array> {
    const response = await this.open(microvmId, path, options);
    return new Uint8Array(await response.arrayBuffer());
  }

  /** Read a file as a stream of bytes, without buffering it (`GET /microvms/:id/files/content`). */
  async readStream(
    microvmId: string,
    path: string,
    options: ReadFileOptions = {}
  ): Promise<ReadableStream<Uint8Array>> {
    const response = await this.open(microvmId, path, options);
    if (!response.body) return new Blob([]).stream();
    return response.body as ReadableStream<Uint8Array>;
  }

  /**
   * Write a file, replacing it atomically (`PUT /microvms/:id/files/content`).
   * Missing parent directories are created unless `mkdirs: false`.
   */
  write(
    microvmId: string,
    path: string,
    content: MicroVmFileContent,
    options: WriteFileOptions = {}
  ): Promise<FileWriteResult> {
    return typed(
      this.httpClient.put<FileWriteResult>(`${vmPath(microvmId)}/files/content`, content, {
        headers: { 'Content-Type': 'application/octet-stream' },
        query: { path, mode: modeString(options.mode), mkdirs: options.mkdirs === false ? false : undefined },
        signal: options.signal,
      }),
      path
    );
  }

  /**
   * List a directory (`GET /microvms/:id/files`). `truncated` is set when the
   * listing hit its size limit; list a narrower directory then.
   */
  async list(
    microvmId: string,
    path: string,
    options: { recursive?: boolean; depth?: number } & MicroVmRequestOptions = {}
  ): Promise<FileListing> {
    const body = await read(
      () =>
        this.httpClient.get<unknown>(`${vmPath(microvmId)}/files`, {
          query: { path, recursive: options.recursive ? true : undefined, depth: options.depth },
          signal: options.signal,
        }),
      options.signal,
      path
    );
    const truncated = (body as { truncated?: unknown } | null)?.truncated === true;
    return { entries: unwrapList<FileEntry>(body, 'entries'), truncated };
  }

  /** Describe a file or directory without following a final symlink (`GET /microvms/:id/files/stat`). */
  stat(microvmId: string, path: string, options: MicroVmRequestOptions = {}): Promise<FileEntry> {
    return read(
      () =>
        this.httpClient.get<FileEntry>(`${vmPath(microvmId)}/files/stat`, { query: { path }, signal: options.signal }),
      options.signal,
      path
    );
  }

  /** Create a directory, with its parents unless `parents: false` (`POST /microvms/:id/files/mkdir`). */
  mkdir(
    microvmId: string,
    path: string,
    options: { parents?: boolean } & MicroVmRequestOptions = {}
  ): Promise<FileEntry> {
    const body = options.parents === undefined ? { path } : { path, parents: options.parents };
    return typed(this.httpClient.post<FileEntry>(`${vmPath(microvmId)}/files/mkdir`, body, options), path);
  }

  /** Move or rename a file or directory (`POST /microvms/:id/files/move`). */
  move(microvmId: string, from: string, to: string, options: MicroVmRequestOptions = {}): Promise<FileEntry> {
    return typed(this.httpClient.post<FileEntry>(`${vmPath(microvmId)}/files/move`, { from, to }, options), from);
  }

  /** Delete a file, or a directory (non-empty ones need `recursive`) (`DELETE /microvms/:id/files`). */
  async remove(
    microvmId: string,
    path: string,
    options: { recursive?: boolean } & MicroVmRequestOptions = {}
  ): Promise<void> {
    await typed(
      this.httpClient.delete<void>(`${vmPath(microvmId)}/files`, {
        query: { path, recursive: options.recursive ? true : undefined },
        signal: options.signal,
      }),
      path
    );
  }

  private open(microvmId: string, path: string, options: ReadFileOptions): Promise<Response> {
    return read(
      () =>
        this.httpClient.requestStream('GET', `${vmPath(microvmId)}/files/content`, {
          query: { path, offset: options.offset, length: options.length },
          signal: options.signal,
        }),
      options.signal,
      path
    );
  }
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/** Options of {@link MicroVmImagesResource.waitUntilReady}. */
export interface WaitForImageOptions extends MicroVmRequestOptions {
  /** Give up after this long. Default `'15m'`. */
  timeout?: MicroVmDuration;
  /** Pause between polls. Default `'2s'`. */
  interval?: MicroVmDuration;
  /** Called whenever the polled status changes. */
  onStatus?: (image: MicroVmImage) => void;
}

const toImageSource = (input: CreateMicroVmImageInput): MicroVmImageSource => {
  if (input.source) return input.source;
  const from = input.from;
  if (typeof from === 'string') return { type: 'registry', ref: from };
  if (from && 'dockerfile' in from) return { type: 'dockerfile', dockerfile: from.dockerfile };
  if (from && 'registry' in from) return { type: 'registry', ref: from.registry };
  throw new TypeError('Pass `from` (a registry reference or { dockerfile }) or `source` to create an image.');
};

/**
 * microVM images: `client.microvms.images`. Built-in images (`node22`,
 * `node24`, `python3.13`, `python3.12`, `bun1`, `debian12`, `ubuntu24.04`)
 * are always available; custom images are built from a registry reference or
 * a Dockerfile.
 */
export class MicroVmImagesResource extends BaseResource {
  private readonly defaultApplicationId: string | undefined;

  constructor(httpClient: HttpClient, defaultApplicationId?: string) {
    super(httpClient);
    this.defaultApplicationId = defaultApplicationId || undefined;
  }

  /** List the built-in images and the application's custom images (`GET /microvm-images`). */
  async list(query: { applicationId?: string } = {}, options: MicroVmRequestOptions = {}): Promise<MicroVmImage[]> {
    const body = await read(
      () =>
        this.httpClient.get<unknown>('/microvm-images', {
          query: { applicationId: query.applicationId ?? this.defaultApplicationId },
          signal: options.signal,
        }),
      options.signal
    );
    return unwrapList<MicroVmImage>(body);
  }

  /**
   * Start building a custom image (`POST /microvm-images`). The image is
   * `building` until {@link waitUntilReady} resolves.
   *
   * @example
   * ```ts
   * const image = await client.microvms.images.create({ name: 'py-ml', from: 'python:3.13' });
   * await client.microvms.images.waitUntilReady(image.id);
   * const vm = await MicroVM.create({ image: 'py-ml' });
   * ```
   */
  async create(input: CreateMicroVmImageInput, options: MicroVmRequestOptions = {}): Promise<MicroVmImage> {
    const applicationId = input.applicationId ?? this.defaultApplicationId;
    const source = toImageSource(input);
    return await typed(
      this.httpClient.post<MicroVmImage>(
        '/microvm-images',
        { ...(applicationId ? { applicationId } : {}), name: input.name, source },
        options
      )
    );
  }

  /** Get one image (`GET /microvm-images/:id`). */
  get(imageId: string, options: MicroVmRequestOptions = {}): Promise<MicroVmImage> {
    return read(
      () => this.httpClient.get<MicroVmImage>(`/microvm-images/${encodeURIComponent(imageId)}`, options),
      options.signal
    );
  }

  /** Delete a custom image (`DELETE /microvm-images/:id`). */
  async delete(imageId: string, options: MicroVmRequestOptions = {}): Promise<void> {
    await typed(this.httpClient.delete<void>(`/microvm-images/${encodeURIComponent(imageId)}`, options));
  }

  /**
   * Poll an image until its build finished.
   *
   * @throws {@link MicroVmImageBuildError} when the build failed.
   * @throws {@link MicroVmTimeoutError} when it is still building after `timeout`.
   */
  async waitUntilReady(imageId: string, options: WaitForImageOptions = {}): Promise<MicroVmImage> {
    const deadline = Date.now() + durationToMs(options.timeout ?? '15m');
    const interval = durationToMs(options.interval ?? '2s');
    let lastStatus: string | undefined;
    for (;;) {
      if (options.signal?.aborted) throw abortReason(options.signal);
      const image = await this.get(imageId, { signal: options.signal });
      if (image.status !== lastStatus) {
        lastStatus = image.status;
        options.onStatus?.(image);
      }
      if (image.status === 'ready') return image;
      if (image.status === 'failed') throw new MicroVmImageBuildError(image.id, image.error);
      if (Date.now() + interval > deadline) {
        throw new MicroVmTimeoutError(`The image ${image.name} is still ${image.status}; gave up waiting.`);
      }
      await sleep(interval, options.signal);
    }
  }
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

const webhookPath = (webhookId: string) => `/microvm-webhooks/${encodeURIComponent(webhookId)}`;

/**
 * microVM lifecycle webhooks: `client.microvms.webhooks`. A webhook receives a
 * signed `POST` whenever a microVM of its application is created, starts,
 * pauses, stops or fails. Verify each request with `verifyMicroVmWebhook`.
 *
 * @example
 * ```ts
 * const webhook = await client.microvms.webhooks.create({
 *   url: 'https://example.com/hooks/microvms',
 *   events: ['microvm.stopped', 'microvm.failed'],
 * });
 * // Store webhook.secret now: it is never shown again.
 * ```
 */
export class MicroVmWebhooksResource extends BaseResource {
  private readonly defaultApplicationId: string | undefined;

  constructor(httpClient: HttpClient, defaultApplicationId?: string) {
    super(httpClient);
    this.defaultApplicationId = defaultApplicationId || undefined;
  }

  /** List the application's webhooks, oldest first, without secrets (`GET /microvm-webhooks`). */
  async list(query: { applicationId?: string } = {}, options: MicroVmRequestOptions = {}): Promise<MicroVmWebhook[]> {
    const body = await this.httpClient.get<unknown>('/microvm-webhooks', {
      query: { applicationId: query.applicationId ?? this.defaultApplicationId },
      signal: options.signal,
    });
    return unwrapList<MicroVmWebhook>(body);
  }

  /**
   * Add a webhook (`POST /microvm-webhooks`). The result carries the signing
   * secret, shown only this once. An application has at most 10 webhooks.
   */
  create(input: CreateMicroVmWebhookInput, options: MicroVmRequestOptions = {}): Promise<MicroVmWebhookWithSecret> {
    const applicationId = input.applicationId ?? this.defaultApplicationId;
    return this.httpClient.post<MicroVmWebhookWithSecret>(
      '/microvm-webhooks',
      applicationId ? { ...input, applicationId } : input,
      options
    );
  }

  /** Get one webhook, without its secret (`GET /microvm-webhooks/:id`). */
  get(webhookId: string, options: MicroVmRequestOptions = {}): Promise<MicroVmWebhook> {
    return this.httpClient.get<MicroVmWebhook>(webhookPath(webhookId), options);
  }

  /** Change a webhook's URL, events, description or enabled state (`PATCH /microvm-webhooks/:id`). */
  update(
    webhookId: string,
    input: UpdateMicroVmWebhookInput,
    options: MicroVmRequestOptions = {}
  ): Promise<MicroVmWebhook> {
    return this.httpClient.patch<MicroVmWebhook>(webhookPath(webhookId), input, options);
  }

  /** Delete a webhook and the deliveries it still had to send (`DELETE /microvm-webhooks/:id`). */
  async delete(webhookId: string, options: MicroVmRequestOptions = {}): Promise<void> {
    await this.httpClient.delete<void>(webhookPath(webhookId), options);
  }

  /** Replace the signing secret; the old one stops signing at once (`POST /microvm-webhooks/:id/secret`). */
  rotateSecret(webhookId: string, options: MicroVmRequestOptions = {}): Promise<MicroVmWebhookWithSecret> {
    return this.httpClient.post<MicroVmWebhookWithSecret>(`${webhookPath(webhookId)}/secret`, undefined, options);
  }

  /** The webhook's 50 most recent deliveries, newest first (`GET /microvm-webhooks/:id/deliveries`). */
  async listDeliveries(webhookId: string, options: MicroVmRequestOptions = {}): Promise<MicroVmWebhookDelivery[]> {
    const body = await this.httpClient.get<unknown>(`${webhookPath(webhookId)}/deliveries`, options);
    return unwrapList<MicroVmWebhookDelivery>(body);
  }
}

const volumePath = (volumeId: string) => `/microvm-volumes/${encodeURIComponent(volumeId)}`;

/**
 * Persistent volumes: `client.microvms.volumes`. A volume is an ext4
 * filesystem that outlives the microVMs it is attached to: attach it at
 * create with `volumes: [{ volumeId, mountPath }]`, and what the microVM
 * wrote there is saved when it stops.
 *
 * @example
 * ```ts
 * const volume = await client.microvms.volumes.create({ name: 'cache', sizeMb: 20480 });
 * const vm = await MicroVM.create({ volumes: [{ volumeId: volume.id, mountPath: '/cache' }] });
 * ```
 */
export class MicroVmVolumesResource extends BaseResource {
  private readonly defaultApplicationId: string | undefined;

  constructor(httpClient: HttpClient, defaultApplicationId?: string) {
    super(httpClient);
    this.defaultApplicationId = defaultApplicationId || undefined;
  }

  /** List the application's volumes, newest first (`GET /microvm-volumes`), following every page. */
  async list(query: { applicationId?: string } = {}, options: MicroVmRequestOptions = {}): Promise<MicroVmVolume[]> {
    const volumes: MicroVmVolume[] = [];
    let cursor: string | undefined;
    do {
      const body = await this.httpClient.get<{
        data?: MicroVmVolume[];
        pagination?: { nextCursor?: string | null; hasMore?: boolean } | null;
      }>('/microvm-volumes', {
        query: { applicationId: query.applicationId ?? this.defaultApplicationId, cursor },
        signal: options.signal,
      });
      volumes.push(...unwrapList<MicroVmVolume>(body));
      cursor = body.pagination?.hasMore ? (body.pagination.nextCursor ?? undefined) : undefined;
    } while (cursor);
    return volumes;
  }

  /** Create an empty volume (`POST /microvm-volumes`). It is formatted when a microVM first attaches it. */
  create(input: CreateMicroVmVolumeInput, options: MicroVmRequestOptions = {}): Promise<MicroVmVolume> {
    const applicationId = input.applicationId ?? this.defaultApplicationId;
    return this.httpClient.post<MicroVmVolume>(
      '/microvm-volumes',
      applicationId ? { ...input, applicationId } : input,
      options
    );
  }

  /** Get one volume (`GET /microvm-volumes/:id`). */
  get(volumeId: string, options: MicroVmRequestOptions = {}): Promise<MicroVmVolume> {
    return this.httpClient.get<MicroVmVolume>(volumePath(volumeId), options);
  }

  /** Rename a volume (`PATCH /microvm-volumes/:id`). */
  rename(volumeId: string, name: string, options: MicroVmRequestOptions = {}): Promise<MicroVmVolume> {
    return this.httpClient.patch<MicroVmVolume>(volumePath(volumeId), { name }, options);
  }

  /** Delete a volume and its contents (`DELETE /microvm-volumes/:id`). An attached volume cannot be deleted. */
  async delete(volumeId: string, options: MicroVmRequestOptions = {}): Promise<void> {
    await this.httpClient.delete<void>(volumePath(volumeId), options);
  }
}

const snapshotPath = (snapshotId: string) => `/microvm-snapshots/${encodeURIComponent(snapshotId)}`;

/**
 * microVM snapshots: `client.microvms.snapshots`. Take one with
 * {@link MicroVmsResource.snapshot} and create (fork) new microVMs from it with
 * `client.microvms.create({ snapshotId })`.
 */
export class MicroVmSnapshotsResource extends BaseResource {
  private readonly defaultApplicationId: string | undefined;

  constructor(httpClient: HttpClient, defaultApplicationId?: string) {
    super(httpClient);
    this.defaultApplicationId = defaultApplicationId || undefined;
  }

  /** List one page of the application's snapshots, newest first (`GET /microvm-snapshots`). */
  async list(query: ListMicroVmSnapshotsQuery = {}, options: MicroVmRequestOptions = {}): Promise<MicroVmSnapshotPage> {
    const body = await read(
      () =>
        this.httpClient.get<{
          data?: MicroVmSnapshot[];
          pagination?: { nextCursor?: string | null; hasMore?: boolean } | null;
        }>('/microvm-snapshots', {
          query: {
            applicationId: query.applicationId ?? this.defaultApplicationId,
            cursor: query.cursor,
            limit: query.limit,
          },
          signal: options.signal,
        }),
      options.signal
    );
    const nextCursor = body.pagination?.nextCursor ?? undefined;
    const hasMore = body.pagination?.hasMore === true && nextCursor !== undefined;
    return { items: unwrapList<MicroVmSnapshot>(body), ...(hasMore ? { nextCursor } : {}), hasMore };
  }

  /** Iterate every snapshot across all pages. */
  async *listAll(
    query: Omit<ListMicroVmSnapshotsQuery, 'cursor'> = {},
    options: MicroVmRequestOptions = {}
  ): AsyncGenerator<MicroVmSnapshot> {
    let cursor: string | undefined;
    do {
      const page = await this.list({ ...query, cursor }, options);
      yield* page.items;
      cursor = page.nextCursor;
    } while (cursor);
  }

  /** Get one snapshot (`GET /microvm-snapshots/:id`). */
  get(snapshotId: string, options: MicroVmRequestOptions = {}): Promise<MicroVmSnapshot> {
    return read(() => this.httpClient.get<MicroVmSnapshot>(snapshotPath(snapshotId), options), options.signal);
  }

  /** Delete a snapshot (`DELETE /microvm-snapshots/:id`). microVMs created from it keep running. */
  async delete(snapshotId: string, options: MicroVmRequestOptions = {}): Promise<void> {
    await typed(this.httpClient.delete<void>(snapshotPath(snapshotId), options));
  }

  /**
   * Poll a snapshot until it is no longer `creating`, and return it: check
   * `status` for `ready` or `failed` (with `error`).
   *
   * @throws {@link MicroVmTimeoutError} when it is still being created after `timeout`.
   */
  waitUntilSettled(
    snapshotId: string,
    options: WaitUntilSettledOptions<MicroVmSnapshot> = {}
  ): Promise<MicroVmSnapshot> {
    return pollUntil(
      (signal) => this.get(snapshotId, { signal }),
      (snapshot) => snapshot.status !== 'creating',
      (snapshot) => `The snapshot ${snapshot.id} is still ${snapshot.status}`,
      options
    );
  }
}

// ---------------------------------------------------------------------------
// microVMs
// ---------------------------------------------------------------------------

/** `{ data, pagination: { nextCursor, hasMore } }`; `items`/`nextCursor` are accepted too. */
interface RawMicroVmPage {
  data?: MicroVmInfo[];
  items?: MicroVmInfo[];
  nextCursor?: string | null;
  pagination?: { nextCursor?: string | null; hasMore?: boolean } | null;
}

/**
 * The microVM REST API: `client.microvms`. Every method maps to exactly one
 * route; responses are the raw JSON shapes. Most code wants the ergonomic
 * {@link MicroVM} class instead (`MicroVM.create`, `vm.run`, `vm.files`).
 *
 * @example
 * ```ts
 * const client = new GigadriveClient();
 * const vm = await client.microvms.create({ image: 'python3.13', ports: [8000] });
 * const result = await client.microvms.commands.run(vm.id, { cmd: 'python3 --version' });
 * await client.microvms.delete(vm.id);
 * ```
 */
export class MicroVmsResource extends BaseResource {
  /** Commands: run, start, logs, wait, stdin, signal, resize. */
  readonly commands: MicroVmCommandsResource;
  /** Files: read, write, list, stat, mkdir, move, remove. */
  readonly files: MicroVmFilesResource;
  /** Built-in and custom images. */
  readonly images: MicroVmImagesResource;
  /** Lifecycle webhooks of an application. */
  readonly webhooks: MicroVmWebhooksResource;
  /** Persistent volumes of an application. */
  readonly volumes: MicroVmVolumesResource;
  /** Snapshots to create (fork) new microVMs from. */
  readonly snapshots: MicroVmSnapshotsResource;

  private readonly defaultApplicationId: string | undefined;

  constructor(httpClient: HttpClient, defaultApplicationId?: string) {
    super(httpClient);
    this.defaultApplicationId = defaultApplicationId || undefined;
    this.commands = new MicroVmCommandsResource(httpClient);
    this.files = new MicroVmFilesResource(httpClient);
    this.images = new MicroVmImagesResource(httpClient, defaultApplicationId);
    this.webhooks = new MicroVmWebhooksResource(httpClient, defaultApplicationId);
    this.volumes = new MicroVmVolumesResource(httpClient, defaultApplicationId);
    this.snapshots = new MicroVmSnapshotsResource(httpClient, defaultApplicationId);
  }

  /**
   * Create a microVM (`POST /microvms`). The API holds the request while the
   * microVM boots, then answers `202` with a `pending` or `starting` one when
   * that takes longer (no capacity yet); with `wait: false` it answers at
   * once. Follow up with {@link waitUntilSettled}, or use `MicroVM.create`,
   * which does.
   *
   * `applicationId` defaults to the client's `applicationId` or
   * `GIGADRIVE_APPLICATION_ID`, and may be omitted entirely with application
   * or deployment credentials.
   */
  create(
    input: CreateMicroVmInput = {},
    options: { wait?: boolean } & MicroVmRequestOptions = {}
  ): Promise<CreatedMicroVmInfo> {
    const applicationId = input.applicationId ?? this.defaultApplicationId;
    return typed(
      this.httpClient.post<CreatedMicroVmInfo>('/microvms', applicationId ? { ...input, applicationId } : input, {
        query: { wait: options.wait === false ? false : undefined },
        signal: options.signal,
      })
    );
  }

  /** List one page of microVMs, newest first (`GET /microvms`). */
  async list(query: ListMicroVmsQuery = {}, options: MicroVmRequestOptions = {}): Promise<MicroVmPage> {
    const body = await read(
      () =>
        this.httpClient.get<RawMicroVmPage>('/microvms', {
          query: {
            applicationId: query.applicationId ?? this.defaultApplicationId,
            status: query.status,
            cursor: query.cursor,
            limit: query.limit,
          },
          signal: options.signal,
        }),
      options.signal
    );
    const nextCursor = body.pagination?.nextCursor ?? body.nextCursor ?? undefined;
    const hasMore = body.pagination?.hasMore ?? nextCursor !== undefined;
    return {
      items: body.data ?? body.items ?? [],
      ...(nextCursor && hasMore ? { nextCursor } : {}),
      hasMore: hasMore && nextCursor !== undefined,
    };
  }

  /**
   * Iterate every microVM across all pages.
   *
   * @example
   * ```ts
   * for await (const vm of client.microvms.listAll({ status: 'running' })) console.log(vm.id);
   * ```
   */
  async *listAll(
    query: Omit<ListMicroVmsQuery, 'cursor'> = {},
    options: MicroVmRequestOptions = {}
  ): AsyncGenerator<MicroVmInfo> {
    let cursor: string | undefined;
    do {
      const page = await this.list({ ...query, cursor }, options);
      yield* page.items;
      cursor = page.nextCursor;
    } while (cursor);
  }

  /** Get one microVM (`GET /microvms/:id`). */
  get(microvmId: string, options: MicroVmRequestOptions = {}): Promise<MicroVmInfo> {
    return read(() => this.httpClient.get<MicroVmInfo>(vmPath(microvmId), options), options.signal);
  }

  /**
   * A microVM's CPU over the last `windowMinutes` (default 15, at most 1440) and,
   * while it runs, its memory and disk use (`GET /microvms/:id/metrics`).
   * Never resumes a paused microVM.
   */
  getMetrics(microvmId: string, options: GetMicroVmMetricsOptions = {}): Promise<MicroVmMetrics> {
    return read(
      () =>
        this.httpClient.get<MicroVmMetrics>(`${vmPath(microvmId)}/metrics`, {
          query: { windowMinutes: options.windowMinutes },
          signal: options.signal,
        }),
      options.signal
    );
  }

  /**
   * Set the remaining lifetime to `timeoutMs` from now (`POST /microvms/:id/timeout`),
   * up to the plan's maximum lifetime.
   */
  extendTimeout(microvmId: string, timeoutMs: number, options: MicroVmRequestOptions = {}): Promise<MicroVmInfo> {
    return typed(this.httpClient.post<MicroVmInfo>(`${vmPath(microvmId)}/timeout`, { timeoutMs }, options));
  }

  /**
   * Replace what a running or paused microVM may reach
   * (`PATCH /microvms/:id/network`). A running microVM keeps running: the new
   * rules apply before this resolves, and connections they no longer allow are
   * closed. A paused one gets them when it resumes.
   */
  updateNetwork(
    microvmId: string,
    policy: MicroVmEgressPolicy,
    options: MicroVmRequestOptions = {}
  ): Promise<MicroVmInfo> {
    // Only the outbound policy: a `MicroVmNetworkPolicy` value passed here may
    // still carry `previews`, which this route does not change.
    const body = {
      egress: policy.egress,
      ...(policy.allow !== undefined ? { allow: policy.allow } : {}),
      ...(policy.inject !== undefined ? { inject: policy.inject } : {}),
    };
    return typed(this.httpClient.patch<MicroVmInfo>(`${vmPath(microvmId)}/network`, body, options));
  }

  /**
   * Issue a new preview token for a microVM with private previews
   * (`POST /microvms/:id/preview-token`). The old token stops working within a
   * second; the new one is shown only in this answer.
   */
  rotatePreviewToken(microvmId: string, options: MicroVmRequestOptions = {}): Promise<{ previewToken: string }> {
    return typed(
      this.httpClient.post<{ previewToken: string }>(`${vmPath(microvmId)}/preview-token`, undefined, options)
    );
  }

  /**
   * Save the attached volumes of a running microVM, which keeps running
   * (`POST /microvms/:id/volumes/save`). Resolves once the save committed;
   * with `wait: false` it resolves at once.
   */
  saveVolumes(microvmId: string, options: { wait?: boolean } & MicroVmRequestOptions = {}): Promise<MicroVmInfo> {
    return typed(
      this.httpClient.post<MicroVmInfo>(`${vmPath(microvmId)}/volumes/save`, undefined, {
        query: { wait: options.wait === false ? false : undefined },
        signal: options.signal,
      })
    );
  }

  /**
   * Stop a microVM (`POST /microvms/:id/stop`). Its disk and memory are
   * discarded. A microVM with volumes answers `stopping` while they are saved.
   */
  stop(microvmId: string, options: MicroVmRequestOptions = {}): Promise<MicroVmInfo> {
    return typed(this.httpClient.post<MicroVmInfo>(`${vmPath(microvmId)}/stop`, undefined, options));
  }

  /**
   * Pause a running microVM with its memory, processes and disk
   * (`POST /microvms/:id/pause`). The answer is `paused`, or `pausing` when
   * the API answered before the capture finished (`202`): follow up with
   * {@link waitUntilSettled}. If the capture fails the microVM keeps running.
   */
  pause(microvmId: string, options: MicroVmLifecycleOptions = {}): Promise<MicroVmInfo> {
    return typed(
      this.httpClient.post<MicroVmInfo>(`${vmPath(microvmId)}/pause`, undefined, {
        query: { wait: options.wait },
        signal: options.signal,
      })
    );
  }

  /**
   * Resume a paused microVM (`POST /microvms/:id/resume`). The answer is
   * `running`, or `resuming` when the API answered first (`202`): follow up
   * with {@link waitUntilSettled}. If the resume fails it stays paused.
   */
  resume(microvmId: string, options: MicroVmLifecycleOptions = {}): Promise<MicroVmInfo> {
    return typed(
      this.httpClient.post<MicroVmInfo>(`${vmPath(microvmId)}/resume`, undefined, {
        query: { wait: options.wait },
        signal: options.signal,
      })
    );
  }

  /**
   * Snapshot a running microVM, which keeps running
   * (`POST /microvms/:id/snapshots`). The answer is `ready` (`201`), or
   * `creating` when the API answered first (`202`): follow up with
   * `client.microvms.snapshots.waitUntilSettled`.
   */
  snapshot(
    microvmId: string,
    input: CreateMicroVmSnapshotInput = {},
    options: MicroVmLifecycleOptions = {}
  ): Promise<MicroVmSnapshot> {
    return typed(
      this.httpClient.post<MicroVmSnapshot>(`${vmPath(microvmId)}/snapshots`, input, {
        query: { wait: options.wait },
        signal: options.signal,
      })
    );
  }

  /**
   * Poll a microVM until its status no longer changes on its own (see
   * {@link MICROVM_TRANSITIONAL_STATUSES}), and return it. Use it after a
   * create, pause or resume the API answered with `202`, then check `status`:
   * a pause that failed leaves the microVM `running`, a resume that failed
   * leaves it `paused`, and a create ends `running` or `failed`.
   *
   * @throws {@link MicroVmTimeoutError} when it is still changing after `timeout`.
   */
  waitUntilSettled(microvmId: string, options: WaitUntilSettledOptions<MicroVmInfo> = {}): Promise<MicroVmInfo> {
    return pollUntil(
      (signal) => this.get(microvmId, { signal }),
      (vm) => !MICROVM_TRANSITIONAL_STATUSES.includes(vm.status),
      (vm) => `The microVM ${vm.id} is still ${vm.status}`,
      options
    );
  }

  /** Delete a microVM, stopping it first if needed (`DELETE /microvms/:id`). */
  async delete(microvmId: string, options: MicroVmRequestOptions = {}): Promise<void> {
    await typed(this.httpClient.delete<void>(vmPath(microvmId), options));
  }

  /**
   * Request a public preview URL with the client's `fetch`, without
   * credentials and without throwing on error statuses. Used by
   * `MicroVM.waitForPort`.
   *
   * @internal
   */
  fetchPreview(url: string, init?: RequestInit): Promise<Response> {
    return this.httpClient.fetchPublic(url, init);
  }
}

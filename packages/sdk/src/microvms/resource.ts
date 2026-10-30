import type { HttpClient } from '../http-client';
import { BaseResource } from '../resources/base-resource';
import { parseSSEEvents } from '../streaming';
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
  FileEntry,
  FileListing,
  FileWriteResult,
  ListMicroVmsQuery,
  MicroVmEgressPolicy,
  MicroVmFileChange,
  MicroVmFileChangeType,
  MicroVmImage,
  MicroVmImageSource,
  MicroVmInfo,
  MicroVmPage,
  PtySize,
  StartCommandInput,
} from './types';

/** Content accepted by file writes: text (UTF-8), bytes, a `Blob`/`File`, or a web `ReadableStream`. */
export type MicroVmFileContent = string | Uint8Array | ArrayBuffer | Blob | ReadableStream<Uint8Array>;

/** Per-call request options. */
export interface MicroVmRequestOptions {
  /** Cancels the request. */
  signal?: AbortSignal;
}

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
  run(microvmId: string, input: StartCommandInput, options: MicroVmRequestOptions = {}): Promise<CommandRunResult> {
    return typed(
      this.httpClient.post<CommandRunResult>(`${vmPath(microvmId)}/commands`, { ...input, wait: true }, options)
    );
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

  private readonly defaultApplicationId: string | undefined;

  constructor(httpClient: HttpClient, defaultApplicationId?: string) {
    super(httpClient);
    this.defaultApplicationId = defaultApplicationId || undefined;
    this.commands = new MicroVmCommandsResource(httpClient);
    this.files = new MicroVmFilesResource(httpClient);
    this.images = new MicroVmImagesResource(httpClient, defaultApplicationId);
  }

  /**
   * Create a microVM (`POST /microvms`). Resolves once it is `running`; with
   * `wait: false` it resolves at once with a `starting` microVM.
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
    return typed(this.httpClient.patch<MicroVmInfo>(`${vmPath(microvmId)}/network`, policy, options));
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

  /** Stop a microVM (`POST /microvms/:id/stop`). Its disk and memory are discarded. */
  stop(microvmId: string, options: MicroVmRequestOptions = {}): Promise<MicroVmInfo> {
    return typed(this.httpClient.post<MicroVmInfo>(`${vmPath(microvmId)}/stop`, undefined, options));
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

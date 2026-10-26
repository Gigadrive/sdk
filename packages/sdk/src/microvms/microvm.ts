import { GigadriveClient, type GigadriveClientConfig } from '../client';
import { Command, commandDurationMs, type CommandOutputCallback } from './command';
import { abortReason, durationToMs, type MicroVmDuration, microvmTimeoutMs, sleep } from './duration';
import {
  CommandFailedError,
  MicroVmCleanupError,
  MicroVmFileNotFoundError,
  MicroVmNotFoundError,
  MicroVmNotRunningError,
  MicroVmPortNotExposedError,
  MicroVmPreviewTokenRequiredError,
  MicroVmStartError,
  MicroVmTimeoutError,
} from './errors';
import type {
  MicroVmCommandsResource,
  MicroVmFileContent,
  MicroVmFilesResource,
  MicroVmsResource,
  ReadFileOptions,
  WriteFileOptions,
} from './resource';
import type {
  CreateMicroVmInput,
  FileEntry,
  FileWriteResult,
  ListMicroVmsQuery,
  MicroVmEgress,
  MicroVmInfo,
  MicroVmNetworkPolicy,
  MicroVmPreviewAccess,
  MicroVmStatus,
  PtySize,
  StartCommandInput,
} from './types';

// ---------------------------------------------------------------------------
// Client resolution
// ---------------------------------------------------------------------------

/** How a {@link MicroVM} reaches the API. */
export interface MicroVmClientOptions {
  /**
   * A configured {@link GigadriveClient}, or the configuration to create one.
   * Default: a shared client configured from the environment
   * (`GIGADRIVE_CLIENT_ID`/`GIGADRIVE_CLIENT_SECRET`, `GIGADRIVE_BEARER_TOKEN`,
   * `GIGADRIVE_APPLICATION_ID`), which deployments and Functions receive
   * automatically.
   */
  client?: GigadriveClient | GigadriveClientConfig;
}

let defaultClient: GigadriveClient | undefined;

const resolveClient = (client: MicroVmClientOptions['client']): GigadriveClient => {
  if (client instanceof GigadriveClient) return client;
  if (client) return new GigadriveClient(client);
  defaultClient ??= new GigadriveClient();
  return defaultClient;
};

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options of {@link MicroVM.create}. */
export interface CreateMicroVmOptions extends Omit<CreateMicroVmInput, 'network'>, MicroVmClientOptions {
  /**
   * Lifetime before the microVM stops automatically: milliseconds or a string
   * such as `'10m'`. Default 5 minutes; extend it later with
   * {@link MicroVM.extendTimeout}. Wins over `timeoutMs`.
   */
  timeout?: MicroVmDuration;
  /** `'deny'` blocks all outbound traffic. Default `'allow'`. */
  network?: MicroVmEgress | MicroVmNetworkPolicy;
  /**
   * `'private'` makes the preview URLs answer only requests that carry the
   * microVM's preview token ({@link MicroVM.previewToken}). Default `'public'`.
   * Wins over `network.previews`.
   */
  previews?: MicroVmPreviewAccess;
  /**
   * Wait until the microVM is running (polling, up to 10 minutes, which covers
   * a wait for capacity). Default `true`. With `false` the returned microVM may
   * still be pending or starting; call {@link MicroVM.waitUntilRunning}.
   */
  wait?: boolean;
  signal?: AbortSignal;
}

/** Options of {@link MicroVM.list}. */
export type ListMicroVmsOptions = Omit<ListMicroVmsQuery, 'cursor'> & MicroVmClientOptions;

/** Options shared by {@link MicroVM.run} and {@link MicroVM.spawn}. */
export interface CommandOptions {
  /** Working directory. Default: the image's working directory. */
  cwd?: string;
  /** Environment variables merged over the microVM's. */
  env?: Record<string, string>;
  /** Run as this user (name, `root` or uid). Default: the image's user. */
  user?: string;
  /** Run as root. Shorthand for `user: 'root'`. */
  sudo?: boolean;
  /** Kill the command (SIGKILL) after this long: milliseconds or `'10m'`. */
  timeout?: MicroVmDuration;
  /** Called with stdout text as it arrives. */
  onStdout?: CommandOutputCallback;
  /** Called with stderr text as it arrives. */
  onStderr?: CommandOutputCallback;
}

/** Options of {@link MicroVM.run}. */
export interface RunOptions extends CommandOptions {
  /** Data written to stdin, which is then closed. */
  stdin?: string | Uint8Array;
  /** Throw {@link CommandFailedError} when the command exits non-zero or is killed. */
  throwOnError?: boolean;
  /** Aborting kills the command (SIGKILL) and rejects with the abort reason. */
  signal?: AbortSignal;
}

/** Options of {@link MicroVM.spawn}. */
export interface SpawnOptions extends CommandOptions {
  /** Keep stdin open for {@link Command.write}. */
  stdin?: boolean;
  /** Run in a pseudo-terminal (`true` is 80x24). Output is merged into stdout. */
  pty?: boolean | PtySize;
}

/** What {@link MicroVM.run} returns. */
export interface CommandResult {
  commandId: string;
  /** Exit code; `null` when a signal killed the process. */
  exitCode: number | null;
  /** Signal that killed the process, if any. */
  signal: string | null;
  /** Whether the command was killed because it ran past its `timeout`. */
  timedOut: boolean;
  stdout: string;
  stderr: string;
  /**
   * Whether output was left out: over 1 MiB per stream for a call without
   * callbacks, or output older than the retained 8 MiB per stream.
   */
  truncated: boolean;
  durationMs: number;
}

/** Options of {@link MicroVM.get}. */
export interface GetMicroVmOptions extends MicroVmClientOptions {
  /**
   * The preview token of a microVM with private previews, as returned at
   * create or by {@link MicroVM.rotatePreviewToken}. The API never returns it
   * again, so keep it to use {@link MicroVM.waitForPort} and
   * {@link MicroVM.shareUrl} on a microVM you reconnect to.
   */
  previewToken?: string;
}

/** Header a request to a private preview URL carries the preview token in. */
export const PREVIEW_TOKEN_HEADER = 'x-gigadrive-preview-token';

/** Options of {@link MicroVM.waitForPort}. */
export interface WaitForPortOptions {
  /** Give up after this long. Default `'60s'`. */
  timeout?: MicroVmDuration;
  /** Pause between probes. Default `'500ms'`. */
  interval?: MicroVmDuration;
  /** Path to request. Default `/`. */
  path?: string;
  signal?: AbortSignal;
}

/**
 * How long {@link MicroVM.create} waits for a microVM to run: the API may wait
 * up to 8 minutes for capacity (a region scaled to zero brings a host up),
 * then the microVM boots.
 */
const CREATE_WAIT_TIMEOUT = '10m';

/** Options of {@link MicroVM.waitUntilRunning}. */
export interface WaitUntilRunningOptions {
  /** Give up after this long. Default `'2m'`. */
  timeout?: MicroVmDuration;
  /** Pause between polls. Default `'500ms'`. */
  interval?: MicroVmDuration;
  signal?: AbortSignal;
}

/** One file of {@link MicroVmFiles.writeMany}. */
export interface FileToWrite {
  path: string;
  content: MicroVmFileContent;
  /** Permission bits, e.g. `'0755'` or `0o755`. */
  mode?: string | number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Status codes the preview gateway answers with while nothing listens on the port. */
const NOT_LISTENING = new Set([502, 503, 504]);
const PROBE_TIMEOUT_MS = 5_000;
const TERMINAL: readonly MicroVmStatus[] = ['stopping', 'stopped', 'failed'];

const toStartInput = (cmd: string, args: string[] | undefined, options: CommandOptions): StartCommandInput => {
  const user = options.sudo ? 'root' : options.user;
  return {
    cmd,
    ...(args ? { args } : {}),
    ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
    ...(options.env ? { env: options.env } : {}),
    ...(user !== undefined ? { user } : {}),
    ...(options.timeout !== undefined ? { timeoutMs: durationToMs(options.timeout) } : {}),
  };
};

const failIfRequested = (result: CommandResult, throwOnError: boolean | undefined): CommandResult => {
  if (throwOnError && result.exitCode !== 0) throw new CommandFailedError(result);
  return result;
};

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

/**
 * Files of one microVM: `vm.files`. Paths are absolute or relative to the
 * user's home directory. All content is binary safe.
 */
export class MicroVmFiles {
  /** @internal */
  constructor(
    private readonly resource: MicroVmFilesResource,
    private readonly microvmId: string
  ) {}

  /** Read a file as bytes. @throws {@link MicroVmFileNotFoundError} */
  read(path: string, options?: ReadFileOptions): Promise<Uint8Array> {
    return this.resource.read(this.microvmId, path, options);
  }

  /** Read a file as UTF-8 text. */
  async readText(path: string, options?: ReadFileOptions): Promise<string> {
    return new TextDecoder().decode(await this.read(path, options));
  }

  /** Read a file as a stream, for files too large to buffer. */
  readStream(path: string, options?: ReadFileOptions): Promise<ReadableStream<Uint8Array>> {
    return this.resource.readStream(this.microvmId, path, options);
  }

  /**
   * Write a file atomically, creating parent directories.
   *
   * @example
   * ```ts
   * await vm.files.write('/app/index.js', 'console.log("hi")');
   * await vm.files.write('/app/logo.png', await (await fetch(url)).blob());
   * ```
   */
  write(path: string, content: MicroVmFileContent, options?: WriteFileOptions): Promise<FileWriteResult> {
    return this.resource.write(this.microvmId, path, content, options);
  }

  /**
   * Write several files, a few at a time. Resolves in input order once all
   * succeeded; rejects with the first failure.
   *
   * @example
   * ```ts
   * await vm.files.writeMany([
   *   { path: 'app/package.json', content: JSON.stringify(pkg) },
   *   { path: 'app/run.sh', content: '#!/bin/sh\nnode .', mode: '0755' },
   * ]);
   * ```
   */
  async writeMany(
    files: readonly FileToWrite[],
    options: { concurrency?: number; signal?: AbortSignal } = {}
  ): Promise<FileWriteResult[]> {
    const results: FileWriteResult[] = new Array<FileWriteResult>(files.length);
    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const index = next++;
        const file = files[index];
        results[index] = await this.write(file.path, file.content, { mode: file.mode, signal: options.signal });
      }
    };
    const workers = Math.max(1, Math.min(options.concurrency ?? 4, files.length));
    await Promise.all(Array.from({ length: workers }, worker));
    return results;
  }

  /**
   * List a directory. `recursive` descends into subdirectories (up to `depth`
   * levels). Very large listings are cut off; `client.microvms.files.list`
   * reports that as `truncated`.
   */
  async list(path = '.', options?: { recursive?: boolean; depth?: number }): Promise<FileEntry[]> {
    return (await this.resource.list(this.microvmId, path, options)).entries;
  }

  /** Describe a file or directory. @throws {@link MicroVmFileNotFoundError} */
  stat(path: string): Promise<FileEntry> {
    return this.resource.stat(this.microvmId, path);
  }

  /** Whether a file or directory exists. */
  async exists(path: string): Promise<boolean> {
    try {
      await this.stat(path);
      return true;
    } catch (error) {
      if (error instanceof MicroVmFileNotFoundError) return false;
      throw error;
    }
  }

  /** Create a directory and its parents (pass `parents: false` to require the parent). */
  mkdir(path: string, options?: { parents?: boolean }): Promise<FileEntry> {
    return this.resource.mkdir(this.microvmId, path, options);
  }

  /** Delete a file, or a directory with `recursive: true`. */
  remove(path: string, options?: { recursive?: boolean }): Promise<void> {
    return this.resource.remove(this.microvmId, path, options);
  }

  /** Move or rename a file or directory. */
  move(from: string, to: string): Promise<FileEntry> {
    return this.resource.move(this.microvmId, from, to);
  }
}

/** Commands of one microVM: `vm.commands`, for reattaching to detached commands. */
export class MicroVmCommands {
  /** @internal */
  constructor(
    private readonly resource: MicroVmCommandsResource,
    private readonly microvmId: string
  ) {}

  /**
   * Reattach to a command, for example one spawned by another process.
   *
   * @example
   * ```ts
   * const command = await vm.commands.get(savedCommandId);
   * for await (const chunk of command.logs()) process.stdout.write(chunk.data);
   * ```
   */
  async get(commandId: string): Promise<Command> {
    return new Command(this.resource, this.microvmId, await this.resource.get(this.microvmId, commandId));
  }

  /** All commands the microVM still remembers, newest first. */
  async list(): Promise<Command[]> {
    const infos = await this.resource.list(this.microvmId);
    return infos.map((info) => new Command(this.resource, this.microvmId, info));
  }
}

// ---------------------------------------------------------------------------
// MicroVM
// ---------------------------------------------------------------------------

/**
 * An isolated Linux machine on Gigadrive Network that you can run commands
 * in, read and write files on, and expose ports from.
 *
 * @example
 * ```ts
 * import { MicroVM } from '@gigadrive/sdk';
 *
 * await using vm = await MicroVM.create({ image: 'node22', ports: [3000], timeout: '10m' });
 * await vm.files.write('server.js', 'require("http").createServer((_, r) => r.end("hi")).listen(3000)');
 * await vm.run('npm init -y');
 * const server = await vm.spawn('node', ['server.js']);
 * await vm.waitForPort(3000);
 * console.log(vm.url(3000));
 * ```
 */
export class MicroVM {
  /** Files inside the microVM. */
  readonly files: MicroVmFiles;
  /** Reattach to commands by id. */
  readonly commands: MicroVmCommands;

  private current: MicroVmInfo;
  private token: string | undefined;

  /** @internal Use {@link MicroVM.create} or {@link MicroVM.get}. */
  constructor(
    private readonly resource: MicroVmsResource,
    info: MicroVmInfo,
    previewToken?: string
  ) {
    this.current = info;
    this.token = previewToken;
    this.files = new MicroVmFiles(resource.files, info.id);
    this.commands = new MicroVmCommands(resource.commands, info.id);
  }

  /**
   * Create a microVM and wait until it runs.
   *
   * @throws {RangeError} When `timeout` is longer than 24 hours.
   *
   * The application is taken from `applicationId`, the client's
   * `applicationId` or `GIGADRIVE_APPLICATION_ID`; inside a Gigadrive
   * deployment or Function nothing needs configuring.
   *
   * @example
   * ```ts
   * const vm = await MicroVM.create({
   *   image: 'python3.13',
   *   vcpus: 2,
   *   memoryMb: 4096,
   *   timeout: '15m',
   *   ports: [8000],
   *   env: { PYTHONUNBUFFERED: '1' },
   *   metadata: { user: 'u_123' },
   *   network: 'deny',
   * });
   * ```
   */
  static async create(options: CreateMicroVmOptions = {}): Promise<MicroVM> {
    const { client, timeout, timeoutMs, network, previews, wait, signal, ...input } = options;
    const resource = resolveClient(client).microvms;
    const policy: MicroVmNetworkPolicy | undefined =
      network === undefined ? undefined : typeof network === 'string' ? { egress: network } : network;
    const { previewToken, ...info } = await resource.create(
      {
        ...input,
        ...(timeout !== undefined
          ? { timeoutMs: microvmTimeoutMs(timeout) }
          : timeoutMs !== undefined
            ? { timeoutMs }
            : {}),
        ...(policy !== undefined || previews !== undefined
          ? { network: { egress: policy?.egress ?? 'allow', ...policy, ...(previews && { previews }) } }
          : {}),
      },
      // Never hold one request open for the whole boot: a create can wait
      // minutes for capacity, longer than proxies in front of the API keep a
      // response open. Start it, then poll.
      { wait: false, signal }
    );
    const vm = new MicroVM(resource, info, previewToken);
    if (wait === false) return vm;
    try {
      return await vm.waitUntilRunning({ timeout: CREATE_WAIT_TIMEOUT, signal });
    } catch (error) {
      // The caller never gets this microVM: delete it so it can't boot later
      // and bill unseen. A microVM that already failed or stopped is left as is.
      if (error instanceof MicroVmStartError) throw error;
      try {
        await vm.delete();
      } catch (cleanupError) {
        throw new MicroVmCleanupError(vm.id, error, cleanupError);
      }
      throw error;
    }
  }

  /**
   * Connect to an existing microVM by id.
   *
   * @throws {@link MicroVmNotFoundError} when it does not exist.
   */
  static async get(microvmId: string, options: GetMicroVmOptions = {}): Promise<MicroVM> {
    const resource = resolveClient(options.client).microvms;
    return new MicroVM(resource, await resource.get(microvmId), options.previewToken);
  }

  /** Alias of {@link MicroVM.get}. */
  static connect(microvmId: string, options: GetMicroVmOptions = {}): Promise<MicroVM> {
    return MicroVM.get(microvmId, options);
  }

  /**
   * Iterate microVMs, newest first, across all pages.
   *
   * @example
   * ```ts
   * for await (const vm of MicroVM.list({ status: 'running' })) {
   *   console.log(vm.id, vm.metadata);
   * }
   * ```
   */
  static async *list(options: ListMicroVmsOptions = {}): AsyncGenerator<MicroVM> {
    const { client, ...query } = options;
    const resource = resolveClient(client).microvms;
    for await (const info of resource.listAll(query)) yield new MicroVM(resource, info);
  }

  /** Stable UUID. */
  get id(): string {
    return this.current.id;
  }

  /** Label used in preview URLs. */
  get slug(): string {
    return this.current.slug;
  }

  get applicationId(): string {
    return this.current.applicationId;
  }

  /** Status as of the last API response; call {@link refresh} for the current one. */
  get status(): MicroVmStatus {
    return this.current.status;
  }

  /** Exposed ports. */
  get ports(): number[] {
    return this.current.ports.map((entry) => entry.port);
  }

  get metadata(): Record<string, string> {
    return this.current.metadata;
  }

  /** When the microVM stops automatically. */
  get expiresAt(): Date | null {
    return this.current.expiresAt ? new Date(this.current.expiresAt) : null;
  }

  /** The full API object as of the last response. */
  get info(): MicroVmInfo {
    return this.current;
  }

  /**
   * The public preview URL of an exposed port.
   *
   * @throws {@link MicroVmPortNotExposedError} when the port was not in `ports` at create.
   *
   * @example
   * ```ts
   * vm.url(3000); // "https://3000-k3j9x2m1q8zt.vm.gigadrive.app"
   * ```
   */
  url(port: number): string {
    const entry = this.current.ports.find((candidate) => candidate.port === port);
    if (!entry) throw new MicroVmPortNotExposedError(port, this.ports);
    return entry.url;
  }

  /**
   * The preview token of a microVM with private previews, when this object
   * knows it: from {@link MicroVM.create}, {@link MicroVM.rotatePreviewToken}
   * or the `previewToken` option of {@link MicroVM.get}. `undefined` for
   * public previews.
   */
  get previewToken(): string | undefined {
    return this.token;
  }

  /**
   * Issue a new preview token and revoke the old one, which stops working
   * within a second. Only for a microVM created with `previews: 'private'`.
   *
   * @returns The new token, also kept as {@link MicroVM.previewToken}.
   */
  async rotatePreviewToken(options: { signal?: AbortSignal } = {}): Promise<string> {
    const { previewToken } = await this.resource.rotatePreviewToken(this.id, { signal: options.signal });
    this.token = previewToken;
    return previewToken;
  }

  /**
   * A link to an exposed port that opens in a browser. For private previews it
   * carries the preview token once: the first visit trades it for a cookie on
   * that preview URL and drops it from the address bar. Share it only with
   * people who should see the port.
   *
   * @throws {@link MicroVmPortNotExposedError} when the port is not exposed.
   * @throws {@link MicroVmPreviewTokenRequiredError} for private previews without a known token.
   */
  shareUrl(port: number): string {
    const base = this.url(port);
    if (this.current.network.previews !== 'private') return base;
    if (this.token === undefined) throw new MicroVmPreviewTokenRequiredError(this.id);
    const url = new URL(base);
    url.searchParams.set('gd_preview_token', this.token);
    return url.toString();
  }

  /** Fetch the latest state. */
  async refresh(options: { signal?: AbortSignal } = {}): Promise<MicroVmInfo> {
    this.current = await this.resource.get(this.id, { signal: options.signal });
    return this.current;
  }

  /**
   * Run a command and wait for it to exit.
   *
   * Pass `args` to execute the program directly, or a single string to run it
   * through `/bin/sh -c` (pipes, `&&`, globbing). Without output callbacks the
   * call makes one request; with `onStdout`/`onStderr`, `stdin` or `signal` it
   * starts the command detached and streams its output.
   *
   * A non-zero exit code is a normal result; pass `throwOnError: true` to
   * reject with {@link CommandFailedError} instead.
   *
   * @example
   * ```ts
   * const { exitCode, stdout } = await vm.run('ls -la /app');
   * await vm.run('npm', ['install'], { cwd: '/app', onStdout: (text) => process.stdout.write(text) });
   * await vm.run('pytest -q', { throwOnError: true, timeout: '5m' });
   * ```
   */
  run(cmd: string, options?: RunOptions): Promise<CommandResult>;
  run(cmd: string, args: string[], options?: RunOptions): Promise<CommandResult>;
  async run(cmd: string, argsOrOptions?: string[] | RunOptions, maybeOptions?: RunOptions): Promise<CommandResult> {
    const args = Array.isArray(argsOrOptions) ? argsOrOptions : undefined;
    const options: RunOptions = (Array.isArray(argsOrOptions) ? maybeOptions : argsOrOptions) ?? {};
    const input = toStartInput(cmd, args, options);
    const streaming =
      options.onStdout !== undefined ||
      options.onStderr !== undefined ||
      options.stdin !== undefined ||
      options.signal !== undefined;

    if (!streaming) {
      const raw = await this.resource.commands.run(this.id, input);
      return failIfRequested(
        {
          commandId: raw.id,
          exitCode: raw.exitCode,
          signal: raw.signal ?? null,
          timedOut: raw.timedOut === true,
          stdout: raw.stdout,
          stderr: raw.stderr,
          truncated: raw.truncated,
          durationMs: raw.durationMs,
        },
        options.throwOnError
      );
    }

    const { signal } = options;
    if (signal?.aborted) throw abortReason(signal);
    const startedAt = Date.now();
    const info = await this.resource.commands.start(
      this.id,
      { ...input, ...(options.stdin !== undefined ? { stdin: true } : {}) },
      { signal }
    );
    const command = new Command(this.resource.commands, this.id, info);
    const kill = () => void command.kill('SIGKILL').catch(() => undefined);
    signal?.addEventListener('abort', kill, { once: true });
    try {
      if (options.stdin !== undefined) await command.end(options.stdin);
      const output = { stdout: '', stderr: '' };
      const expected = { stdout: 0, stderr: 0 };
      let truncated = false;
      for await (const chunk of command.logs({ signal })) {
        if (chunk.offset > expected[chunk.stream]) truncated = true;
        expected[chunk.stream] = chunk.offset + chunk.data.length;
        output[chunk.stream] += chunk.text;
        await (chunk.stream === 'stdout' ? options.onStdout : options.onStderr)?.(chunk.text, chunk);
      }
      const final = command.status === 'exited' ? command.info : await command.wait({ signal });
      return failIfRequested(
        {
          commandId: command.id,
          exitCode: final.exitCode,
          signal: final.signal,
          timedOut: final.timedOut === true,
          ...output,
          truncated: truncated || command.truncated,
          durationMs: commandDurationMs(final) ?? Date.now() - startedAt,
        },
        options.throwOnError
      );
    } finally {
      signal?.removeEventListener('abort', kill);
    }
  }

  /**
   * Start a command in the background and return a {@link Command} handle at
   * once. Use it for servers, watchers and interactive programs.
   *
   * @example
   * ```ts
   * const dev = await vm.spawn('npm', ['run', 'dev'], { cwd: '/app', onStdout: console.log });
   * await vm.waitForPort(3000);
   *
   * const repl = await vm.spawn('python3', [], { pty: { cols: 120, rows: 40 } });
   * await repl.write('print(1 + 1)\n');
   * ```
   */
  spawn(cmd: string, options?: SpawnOptions): Promise<Command>;
  spawn(cmd: string, args: string[], options?: SpawnOptions): Promise<Command>;
  async spawn(cmd: string, argsOrOptions?: string[] | SpawnOptions, maybeOptions?: SpawnOptions): Promise<Command> {
    const args = Array.isArray(argsOrOptions) ? argsOrOptions : undefined;
    const options: SpawnOptions = (Array.isArray(argsOrOptions) ? maybeOptions : argsOrOptions) ?? {};
    const pty = options.pty === true ? { cols: 80, rows: 24 } : options.pty || undefined;
    const info = await this.resource.commands.start(this.id, {
      ...toStartInput(cmd, args, options),
      ...(options.stdin ? { stdin: true } : {}),
      ...(pty ? { pty } : {}),
    });
    const command = new Command(this.resource.commands, this.id, info);
    if (options.onStdout || options.onStderr) command.startOutputPump(options.onStdout, options.onStderr);
    return command;
  }

  /**
   * Set the remaining lifetime to `duration` from now (up to the plan's
   * maximum lifetime).
   *
   * @example
   * ```ts
   * await vm.extendTimeout('30m');
   * ```
   */
  async extendTimeout(duration: MicroVmDuration): Promise<MicroVmInfo> {
    this.current = await this.resource.extendTimeout(this.id, microvmTimeoutMs(duration));
    return this.current;
  }

  /** Stop the microVM. Its disk, memory and running commands are discarded. */
  async stop(): Promise<MicroVmInfo> {
    this.current = await this.resource.stop(this.id);
    return this.current;
  }

  /** Delete the microVM, stopping it first if needed. */
  async delete(): Promise<void> {
    await this.resource.delete(this.id);
  }

  /**
   * Poll until the microVM is running, for microVMs created with `wait: false`.
   *
   * @throws {@link MicroVmStartError} when it failed or stopped instead.
   * @throws {@link MicroVmTimeoutError} when it is still starting after `timeout`.
   */
  async waitUntilRunning(options: WaitUntilRunningOptions = {}): Promise<this> {
    const deadline = Date.now() + durationToMs(options.timeout ?? '2m');
    const interval = durationToMs(options.interval ?? '500ms');
    while (this.current.status !== 'running') {
      if (TERMINAL.includes(this.current.status)) {
        throw new MicroVmStartError(this.id, this.current.status, this.current.stopReason);
      }
      if (Date.now() + interval > deadline) {
        throw new MicroVmTimeoutError(`The microVM ${this.id} is still ${this.current.status}; gave up waiting.`);
      }
      await sleep(interval, options.signal);
      await this.refresh({ signal: options.signal });
      if (options.signal?.aborted) throw abortReason(options.signal);
    }
    return this;
  }

  /**
   * Poll an exposed port's preview URL until a server answers (any status
   * other than 502, 503 or 504, which the gateway returns while nothing
   * listens).
   *
   * @returns The preview URL.
   * @throws {@link MicroVmPortNotExposedError} when the port is not exposed.
   * @throws {@link MicroVmNotRunningError} when the microVM has stopped.
   * @throws {@link MicroVmTimeoutError} when nothing answers within `timeout`.
   *
   * @example
   * ```ts
   * await vm.spawn('python3', ['-m', 'http.server', '8000']);
   * const url = await vm.waitForPort(8000);
   * ```
   */
  async waitForPort(port: number, options: WaitForPortOptions = {}): Promise<string> {
    const base = this.url(port);
    const isPrivate = this.current.network.previews === 'private';
    if (isPrivate && this.token === undefined) throw new MicroVmPreviewTokenRequiredError(this.id);
    const path = options.path ?? '/';
    const target = `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
    const deadline = Date.now() + durationToMs(options.timeout ?? '60s');
    const interval = durationToMs(options.interval ?? '500ms');
    for (;;) {
      if (options.signal?.aborted) throw abortReason(options.signal);
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        Math.min(PROBE_TIMEOUT_MS, Math.max(1, deadline - Date.now()))
      );
      const forward = () => controller.abort();
      options.signal?.addEventListener('abort', forward, { once: true });
      let stopped = false;
      try {
        const response = await this.resource.fetchPreview(target, {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          ...(isPrivate && this.token !== undefined && { headers: { [PREVIEW_TOKEN_HEADER]: this.token } }),
        });
        // The gateway refused the token (rotated elsewhere): no answer can tell us anything.
        if (
          response.status === 401 &&
          response.headers.get('x-gigadrive-error') === 'EDGE_MICROVM_PREVIEW_UNAUTHORIZED'
        ) {
          await response.body?.cancel().catch(() => undefined);
          throw new MicroVmPreviewTokenRequiredError(this.id);
        }
        await response.body?.cancel().catch(() => undefined);
        // The gateway's own 410: the microVM stopped, so nothing will ever answer.
        stopped = response.status === 410 && response.headers.get('x-gigadrive-error') === 'EDGE_MICROVM_STOPPED';
        if (!stopped && !NOT_LISTENING.has(response.status)) return base;
      } catch (error) {
        if (error instanceof MicroVmPreviewTokenRequiredError) throw error;
        // Connection errors mean nothing answers yet; keep polling.
        if (options.signal?.aborted) throw abortReason(options.signal);
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', forward);
      }
      if (stopped) {
        throw new MicroVmNotRunningError(`The microVM ${this.id} has stopped; nothing will answer on port ${port}.`);
      }
      if (Date.now() + interval > deadline) {
        throw new MicroVmTimeoutError(`Nothing answered on port ${port} of the microVM ${this.id}.`);
      }
      await sleep(interval, options.signal);
    }
  }

  /** Stops the microVM at the end of an `await using` block. Already stopped microVMs are fine. */
  async [Symbol.asyncDispose](): Promise<void> {
    try {
      await this.stop();
    } catch (error) {
      if (error instanceof MicroVmNotRunningError || error instanceof MicroVmNotFoundError) return;
      throw error;
    }
  }

  /** JSON form: the API object. */
  toJSON(): MicroVmInfo {
    return this.current;
  }
}

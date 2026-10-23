import { Args, Command, Options } from '@effect/cli';
import { FileSystem, Path } from '@effect/platform';
import {
  type CreateMicroVmInput,
  durationToMs,
  type FileEntry,
  type GigadriveClient,
  MicroVM,
  MICROVM_MAX_TIMEOUT_MS,
  type MicroVmDuration,
  type MicroVmImage,
  type MicroVmStatus,
} from '@gigadrive/sdk';
import { Config, Console, Effect, Exit, Option } from 'effect';
import {
  type ApiRequestError,
  InvalidCopyTargetError,
  InvalidMicroVmOptionsError,
  LocalFileError,
  TerminalRequiredError,
} from '../../errors';
import {
  type CopyTarget,
  describeMicroVm,
  exitStatusOf,
  formatBytes,
  formatImageTable,
  formatMicroVmTable,
  parseCopyTarget,
  parseKeyValues,
  posixBasename,
  posixJoin,
  relativeTo,
} from '../../lib/microvm';
import { attachCommand, nodeSessionIo, type SessionIo } from '../../lib/microvm-session';
import { ApiClientService, toApiRequestError } from '../../services/api-client';
import { ProjectLinkService } from '../../services/project-link';

const CONSOLE_URL = 'https://console.gigadrive.de';

const MICROVM_STATUSES = [
  'pending',
  'starting',
  'running',
  'stopping',
  'stopped',
  'failed',
] as const satisfies ReadonlyArray<MicroVmStatus>;

/** Login shell: bash when the image has it, else sh. */
const DEFAULT_SHELL = ['/bin/sh', '-c', 'if command -v bash >/dev/null 2>&1; then exec bash -l; else exec sh -l; fi'];

// ---------------------------------------------------------------------------
// Shared options
// ---------------------------------------------------------------------------

const appOption = Options.text('app').pipe(
  Options.withAlias('a'),
  Options.withDescription('Application ID (defaults to the linked application)'),
  Options.optional
);

const jsonOption = Options.boolean('json').pipe(Options.withDescription('Print the result as JSON'));

const microvmIdArg = Args.text({ name: 'microvm-id' }).pipe(Args.withDescription('The microVM ID'));

const envOption = Options.text('env').pipe(
  Options.withAlias('e'),
  Options.withDescription('Environment variable as KEY=VALUE (repeatable)'),
  Options.repeated
);

const userOption = Options.text('user').pipe(
  Options.withAlias('u'),
  Options.withDescription('Run as this user (default: the image user)'),
  Options.optional
);

const cwdOption = Options.text('cwd').pipe(
  Options.withAlias('w'),
  Options.withDescription('Working directory inside the microVM'),
  Options.optional
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** What to tell the user for a failed microVM command. */
export const errorMessage = (
  action: string,
  error: { readonly _tag: string; readonly message: string; readonly code?: string; readonly statusCode?: number }
) => {
  switch (error._tag) {
    case 'NotAuthenticatedError':
      return 'You are not logged in. Run "gigadrive login" to authenticate.';
    case 'ApiRequestError':
      if (error.code === 'microvm_not_running') {
        return `${error.message}\nThe microVM has stopped. Create a new one with "gigadrive microvms create".`;
      }
      if (error.code === 'quota_exceeded' || error.code === 'plan_limit_exceeded') {
        return `${error.message}\nStop microVMs you no longer need, or raise your plan's limits at ${CONSOLE_URL}.`;
      }
      if (error.code === 'microvm_busy') {
        return `${error.message}\nThe microVM is busy. Wait a moment and try again.`;
      }
      if (error.code === 'microvm_unreachable') {
        return `${error.message}\nThe microVM could not be reached. Try again; if it keeps failing, check "gigadrive microvms get <id>".`;
      }
      if (error.code === 'image_not_ready') {
        return `${error.message}\nThe image is not built yet. Check it with "gigadrive microvms images ls".`;
      }
      return `Failed to ${action}: ${error.message}`;
    default:
      return error.message;
  }
};

/** Prints what went wrong while keeping the typed error, so the command exits non-zero. */
const reportErrors =
  (action: string) =>
  <A, E extends { readonly _tag: string; readonly message: string }, R>(self: Effect.Effect<A, E, R>) =>
    Effect.tapError(self, (error) => Console.error(errorMessage(action, error)));

/** Parses a `--timeout`-style flag. A bare number is refused because its unit would be ambiguous. */
export const parseDuration = (flag: string, value: string) =>
  Effect.try({
    try: () => {
      if (/^\d+(\.\d+)?$/.test(value.trim())) throw new RangeError('missing unit');
      return durationToMs(value as MicroVmDuration);
    },
    catch: () =>
      new InvalidMicroVmOptionsError({
        message: `${flag} must be a duration with a unit, such as 90s, 10m or 1h (got "${value}").`,
      }),
  });

const optionalDuration = (flag: string, value: Option.Option<string>) =>
  Option.match(value, {
    onNone: () => Effect.succeed(undefined),
    onSome: (text) => parseDuration(flag, text),
  });

/** Parses a microVM lifetime: a duration of at most 24 hours. */
export const parseLifetime = (flag: string, value: string) =>
  parseDuration(flag, value).pipe(
    Effect.filterOrFail(
      (ms) => ms >= 1 && ms <= MICROVM_MAX_TIMEOUT_MS,
      () => new InvalidMicroVmOptionsError({ message: `${flag} can be at most 24h (got "${value}").` })
    )
  );

const keyValues = (flag: string, entries: ReadonlyArray<string>) => {
  const parsed = parseKeyValues(entries);
  return parsed.ok
    ? Effect.succeed(entries.length > 0 ? parsed.value : undefined)
    : Effect.fail(new InvalidMicroVmOptionsError({ message: `${flag} expects KEY=VALUE, got "${parsed.entry}".` }));
};

/** `--app`, else the linked application, else none (the API infers it for application credentials). */
const resolveApplicationId = (app: Option.Option<string>) =>
  Option.match(app, {
    onSome: (id) => Effect.succeed<string | undefined>(id),
    onNone: () =>
      Effect.gen(function* () {
        const projectLink = yield* ProjectLinkService;
        const link = yield* projectLink.load(process.cwd());
        return Option.match(link, { onNone: () => undefined, onSome: (value) => value.applicationId });
      }),
  });

/** Runs a promise-returning SDK flow against the authenticated client. */
const withClient = <A>(run: (client: GigadriveClient) => Promise<A>) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const client = yield* apiClient.getClient;
    return yield* Effect.tryPromise({ try: () => run(client), catch: toApiRequestError });
  });

/** Sends `signal` to a command when the CLI is interrupted (Ctrl-C outside a PTY), best effort. */
const signalOnInterrupt =
  (signal: 'SIGINT' | 'SIGHUP') =>
  (command: { kill: (signal: 'SIGINT' | 'SIGHUP') => Promise<void> }, exit: Exit.Exit<unknown, unknown>) =>
    Exit.isInterrupted(exit)
      ? Effect.tryPromise(() => command.kill(signal)).pipe(Effect.timeout('2 seconds'), Effect.ignore)
      : Effect.void;

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

/** Flags of `microvms create`. */
export interface CreateFlags {
  readonly app: Option.Option<string>;
  readonly image: Option.Option<string>;
  readonly vcpus: Option.Option<'1' | '2' | '4' | '8'>;
  readonly memory: Option.Option<number>;
  readonly disk: Option.Option<number>;
  readonly timeout: Option.Option<string>;
  readonly ports: ReadonlyArray<number>;
  readonly env: ReadonlyArray<string>;
  readonly metadata: ReadonlyArray<string>;
  readonly denyEgress: boolean;
  readonly region: Option.Option<string>;
  readonly json: boolean;
}

/** Turns `create` flags into the API body. */
export const createInput = (flags: CreateFlags) =>
  Effect.gen(function* () {
    const env = yield* keyValues('--env', flags.env);
    const metadata = yield* keyValues('--metadata', flags.metadata);
    const timeoutMs = yield* Option.match(flags.timeout, {
      onNone: () => Effect.succeed(undefined),
      onSome: (text) => parseLifetime('--timeout', text),
    });
    const badPort = flags.ports.find((port) => !Number.isInteger(port) || port < 1 || port > 65535);
    if (badPort !== undefined) {
      return yield* new InvalidMicroVmOptionsError({ message: `--port must be between 1 and 65535 (got ${badPort}).` });
    }
    const applicationId = yield* resolveApplicationId(flags.app);
    const input: CreateMicroVmInput = {
      ...(applicationId ? { applicationId } : {}),
      ...Option.match(flags.image, { onNone: () => ({}), onSome: (image) => ({ image }) }),
      ...Option.match(flags.vcpus, {
        onNone: () => ({}),
        onSome: (vcpus) => ({ vcpus: Number(vcpus) as 1 | 2 | 4 | 8 }),
      }),
      ...Option.match(flags.memory, { onNone: () => ({}), onSome: (memoryMb) => ({ memoryMb }) }),
      ...Option.match(flags.disk, { onNone: () => ({}), onSome: (diskMb) => ({ diskMb }) }),
      ...(timeoutMs !== undefined ? { timeoutMs } : {}),
      ...(flags.ports.length > 0 ? { ports: [...flags.ports] } : {}),
      ...(env ? { env } : {}),
      ...(metadata ? { metadata } : {}),
      ...(flags.denyEgress ? { network: { egress: 'deny' as const } } : {}),
      ...Option.match(flags.region, { onNone: () => ({}), onSome: (region) => ({ region }) }),
    };
    return input;
  });

/** Creates a microVM and prints it. */
export const createMicroVm = (flags: CreateFlags) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const input = yield* createInput(flags);
    if (!flags.json) yield* Console.error(`Creating a microVM from ${input.image ?? 'node22'}...`);
    const vm = yield* apiClient.request((client) => client.microvms.create(input));
    if (flags.json) {
      yield* Console.log(JSON.stringify(vm, null, 2));
      return vm;
    }
    for (const line of describeMicroVm(vm)) yield* Console.log(line);
    yield* Console.log(`\nRun a command: gigadrive microvms exec ${vm.id} -- <command>`);
    yield* Console.log(`Open a shell:  gigadrive microvms shell ${vm.id}`);
    return vm;
  });

const createCommand = Command.make(
  'create',
  {
    app: appOption,
    image: Options.text('image').pipe(
      Options.withAlias('i'),
      Options.withDescription(
        'Image name or ID: node22, node24, python3.13, python3.12, bun1, debian12, ubuntu24.04, or a custom image (default: node22)'
      ),
      Options.optional
    ),
    vcpus: Options.choice('vcpus', ['1', '2', '4', '8'] as const).pipe(
      Options.withDescription('Number of vCPUs (default: 1)'),
      Options.optional
    ),
    memory: Options.integer('memory').pipe(Options.withDescription('Memory in MiB (default: 2048)'), Options.optional),
    disk: Options.integer('disk').pipe(Options.withDescription('Disk in MiB (default: 10240)'), Options.optional),
    timeout: Options.text('timeout').pipe(
      Options.withAlias('t'),
      Options.withDescription('Lifetime before it stops automatically, such as 30m or 2h (default: 5m)'),
      Options.optional
    ),
    ports: Options.integer('port').pipe(
      Options.withAlias('p'),
      Options.withDescription('Port to expose on a public preview URL (repeatable, up to 8)'),
      Options.repeated
    ),
    env: envOption,
    metadata: Options.text('metadata').pipe(
      Options.withAlias('m'),
      Options.withDescription('Metadata as KEY=VALUE (repeatable)'),
      Options.repeated
    ),
    denyEgress: Options.boolean('deny-egress').pipe(Options.withDescription('Block all outbound network traffic')),
    region: Options.text('region').pipe(Options.withDescription('Region to place the microVM in'), Options.optional),
    json: jsonOption,
  },
  (flags) => createMicroVm(flags).pipe(Effect.asVoid, reportErrors('create the microVM'))
).pipe(Command.withDescription('Create a microVM and wait until it runs'));

// ---------------------------------------------------------------------------
// ls / get
// ---------------------------------------------------------------------------

/** Flags of `microvms ls`. */
export interface ListFlags {
  readonly app: Option.Option<string>;
  readonly status: Option.Option<MicroVmStatus>;
  readonly all: boolean;
  readonly limit: number;
  readonly json: boolean;
}

/** Lists microVMs: live ones by default, stopped and failed ones too with `--all`. */
export const listMicroVms = (flags: ListFlags) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const applicationId = yield* resolveApplicationId(flags.app);
    const status = Option.getOrUndefined(flags.status);
    const showAll = flags.all || status !== undefined;
    const vms = yield* apiClient.request(async (client) => {
      const items = [];
      for await (const vm of client.microvms.listAll({ applicationId, status, limit: Math.min(flags.limit, 100) })) {
        if (!showAll && (vm.status === 'stopped' || vm.status === 'failed')) continue;
        items.push(vm);
        if (items.length >= flags.limit) break;
      }
      return items;
    });
    if (flags.json) return yield* Console.log(JSON.stringify(vms, null, 2));
    if (vms.length === 0) {
      return yield* Console.log(
        showAll ? 'No microVMs found.' : 'No running microVMs. Create one with "gigadrive microvms create".'
      );
    }
    for (const line of formatMicroVmTable(vms)) yield* Console.log(line);
  });

const listCommand = Command.make(
  'ls',
  {
    app: appOption,
    status: Options.choice('status', MICROVM_STATUSES).pipe(
      Options.withAlias('s'),
      Options.withDescription('Only microVMs in this status'),
      Options.optional
    ),
    all: Options.boolean('all').pipe(Options.withDescription('Include stopped and failed microVMs')),
    limit: Options.integer('limit').pipe(
      Options.withDescription('Show at most this many (default: 50)'),
      Options.withDefault(50)
    ),
    json: jsonOption,
  },
  (flags) => listMicroVms(flags).pipe(reportErrors('list microVMs'))
).pipe(Command.withDescription('List microVMs'));

const getCommand = Command.make('get', { microvmId: microvmIdArg, json: jsonOption }, ({ microvmId, json }) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const vm = yield* apiClient.request((client) => client.microvms.get(microvmId));
    if (json) return yield* Console.log(JSON.stringify(vm, null, 2));
    for (const line of describeMicroVm(vm)) yield* Console.log(line);
  }).pipe(reportErrors('get the microVM'))
).pipe(Command.withDescription('Show a microVM'));

// ---------------------------------------------------------------------------
// exec / shell
// ---------------------------------------------------------------------------

/** Flags of `microvms exec`. */
export interface ExecFlags {
  readonly microvmId: string;
  readonly command: readonly [string, ...string[]];
  readonly cwd: Option.Option<string>;
  readonly env: ReadonlyArray<string>;
  readonly user: Option.Option<string>;
  readonly sudo: boolean;
  readonly timeout: Option.Option<string>;
  readonly interactive: boolean;
}

/**
 * Runs a command in a microVM, streaming its stdout and stderr to the local
 * ones and, with `--interactive`, local stdin to it.
 *
 * @returns The local exit status: the command's exit code, or 128 + signal.
 */
export const execInMicroVm = (flags: ExecFlags, io: SessionIo = nodeSessionIo()) =>
  Effect.gen(function* () {
    const env = yield* keyValues('--env', flags.env);
    const timeout = yield* optionalDuration('--timeout', flags.timeout);
    const [cmd, ...args] = flags.command;
    const options = {
      cwd: Option.getOrUndefined(flags.cwd),
      env,
      user: Option.getOrUndefined(flags.user),
      sudo: flags.sudo,
      timeout,
      stdin: flags.interactive,
    };
    const info = yield* Effect.acquireUseRelease(
      withClient(async (client) => {
        const vm = await MicroVM.get(flags.microvmId, { client });
        return args.length > 0 ? vm.spawn(cmd, args, options) : vm.spawn(cmd, options);
      }),
      (command) =>
        Effect.tryPromise({
          try: () =>
            attachCommand(command, io, {
              forwardInput: flags.interactive,
              endInputOnEof: true,
              forwardResize: false,
            }),
          catch: toApiRequestError,
        }),
      signalOnInterrupt('SIGINT')
    );
    return exitStatusOf(info);
  });

const setExitCode = (status: number) =>
  Effect.sync(() => {
    process.exitCode = status;
  });

const execCommand = Command.make(
  'exec',
  {
    microvmId: microvmIdArg,
    command: Args.text({ name: 'command' }).pipe(
      Args.withDescription('The command and its arguments, after "--". One quoted argument runs through /bin/sh -c'),
      Args.atLeast(1)
    ),
    cwd: cwdOption,
    env: envOption,
    user: userOption,
    sudo: Options.boolean('sudo').pipe(Options.withDescription('Run as root')),
    timeout: Options.text('timeout').pipe(
      Options.withAlias('t'),
      Options.withDescription('Kill the command after this long, such as 30s or 10m'),
      Options.optional
    ),
    interactive: Options.boolean('interactive').pipe(
      Options.withAlias('i'),
      Options.withDescription('Forward local stdin to the command')
    ),
  },
  (flags) => execInMicroVm(flags).pipe(Effect.flatMap(setExitCode), reportErrors('run the command'))
).pipe(Command.withDescription('Run a command in a microVM and exit with its exit code: exec <id> -- <command...>'));

/** Flags of `microvms shell`. */
export interface ShellFlags {
  readonly microvmId: string;
  readonly shell: Option.Option<string>;
  readonly cwd: Option.Option<string>;
  readonly user: Option.Option<string>;
}

/**
 * Opens an interactive terminal: a PTY command in the microVM, local stdin in
 * raw mode forwarded to it, its output to stdout, and terminal resizes
 * propagated.
 *
 * @returns The local exit status of the shell.
 */
export const openShell = (flags: ShellFlags, io: SessionIo = nodeSessionIo()) =>
  Effect.gen(function* () {
    if (process.stdin.isTTY !== true || process.stdout.isTTY !== true) {
      return yield* new TerminalRequiredError({
        message:
          'microvms shell needs an interactive terminal. Use "gigadrive microvms exec <id> -- <command>" in scripts.',
      });
    }
    const term = yield* Config.string('TERM').pipe(Config.withDefault('xterm-256color'));
    const size = io.size() ?? { cols: 80, rows: 24 };
    const [cmd, ...args] = Option.match(flags.shell, { onNone: () => DEFAULT_SHELL, onSome: (shell) => [shell] });
    const options = {
      pty: { cols: size.cols, rows: size.rows },
      env: { TERM: term },
      cwd: Option.getOrUndefined(flags.cwd),
      user: Option.getOrUndefined(flags.user),
    };
    const info = yield* Effect.acquireUseRelease(
      withClient(async (client) => {
        const vm = await MicroVM.get(flags.microvmId, { client });
        return args.length > 0 ? vm.spawn(cmd, args, options) : vm.spawn(cmd, options);
      }),
      (command) =>
        Effect.acquireUseRelease(
          Effect.sync(() => process.stdin.setRawMode(true)),
          () =>
            Effect.tryPromise({
              try: () => attachCommand(command, io, { forwardInput: true, endInputOnEof: false, forwardResize: true }),
              catch: toApiRequestError,
            }),
          () => Effect.sync(() => process.stdin.setRawMode(false))
        ),
      signalOnInterrupt('SIGHUP')
    );
    return exitStatusOf(info);
  });

const shellCommand = Command.make(
  'shell',
  {
    microvmId: microvmIdArg,
    shell: Options.text('shell').pipe(
      Options.withDescription('Program to run instead of the login shell, such as python3'),
      Options.optional
    ),
    cwd: cwdOption,
    user: userOption,
  },
  (flags) => openShell(flags).pipe(Effect.flatMap(setExitCode), reportErrors('open a shell'))
).pipe(Command.withDescription('Open an interactive shell in a microVM'));

// ---------------------------------------------------------------------------
// cp
// ---------------------------------------------------------------------------

const localError = (path: string, action: string) => () =>
  new LocalFileError({ message: `Failed to ${action} ${path}`, path });

/** Result of {@link copyFiles}. */
export interface CopyResult {
  readonly files: number;
  readonly bytes: number;
}

const parseTarget = (value: string) => {
  const target = parseCopyTarget(value);
  return typeof target === 'string'
    ? Effect.fail(new InvalidCopyTargetError({ message: target }))
    : Effect.succeed(target);
};

const remoteStat = (client: GigadriveClient, microvmId: string, path: string) =>
  Effect.tryPromise({ try: () => client.microvms.files.stat(microvmId, path), catch: toApiRequestError }).pipe(
    Effect.map(Option.some<FileEntry>),
    Effect.catchIf(
      (error: ApiRequestError) => error.statusCode === 404,
      () => Effect.succeed(Option.none<FileEntry>())
    )
  );

/** Copies a local file or directory into a microVM. */
const upload = (client: GigadriveClient, source: string, target: Extract<CopyTarget, { kind: 'remote' }>) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const info = yield* fs.stat(source).pipe(Effect.mapError(localError(source, 'read')));
    const existing = yield* remoteStat(client, target.microvmId, target.path);
    const intoDirectory = target.path.endsWith('/') || Option.exists(existing, (entry) => entry.type === 'directory');
    const destination = intoDirectory ? posixJoin(target.path, path.basename(source)) : target.path;

    const files: Array<{ local: string; remote: string }> = [];
    if (info.type === 'Directory') {
      const entries = yield* fs
        .readDirectory(source, { recursive: true })
        .pipe(Effect.mapError(localError(source, 'list')));
      for (const entry of entries) {
        const local = path.join(source, entry);
        const stat = yield* fs.stat(local).pipe(Effect.mapError(localError(local, 'read')));
        if (stat.type === 'File')
          files.push({ local, remote: posixJoin(destination, entry.split(path.sep).join('/')) });
      }
    } else {
      files.push({ local: source, remote: destination });
    }

    let bytes = 0;
    for (const file of files) {
      const content = yield* fs.readFile(file.local).pipe(Effect.mapError(localError(file.local, 'read')));
      const result = yield* Effect.tryPromise({
        try: () => client.microvms.files.write(target.microvmId, file.remote, content),
        catch: toApiRequestError,
      });
      bytes += result.bytes;
    }
    return { files: files.length, bytes };
  });

/** Copies a file or directory out of a microVM. */
const download = (client: GigadriveClient, source: Extract<CopyTarget, { kind: 'remote' }>, target: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const entry = yield* Effect.tryPromise({
      try: () => client.microvms.files.stat(source.microvmId, source.path),
      catch: toApiRequestError,
    });
    const targetExists = yield* fs.exists(target).pipe(Effect.mapError(localError(target, 'check')));
    const targetIsDirectory = targetExists
      ? (yield* fs.stat(target).pipe(Effect.mapError(localError(target, 'read')))).type === 'Directory'
      : false;
    const intoDirectory = targetIsDirectory || target.endsWith(path.sep) || target.endsWith('/');
    const destination = intoDirectory ? path.join(target, posixBasename(entry.path)) : target;

    const files: Array<{ remote: string; local: string }> = [];
    if (entry.type === 'directory') {
      const listing = yield* Effect.tryPromise({
        try: () => client.microvms.files.list(source.microvmId, entry.path, { recursive: true }),
        catch: toApiRequestError,
      });
      if (listing.truncated) {
        yield* Console.error(
          `${entry.path} has too many files to list at once; only part of it is copied. Copy its subdirectories separately.`
        );
      }
      for (const child of listing.entries) {
        if (child.type !== 'file') continue;
        files.push({
          remote: child.path,
          local: path.join(destination, ...relativeTo(entry.path, child.path).split('/')),
        });
      }
      yield* fs
        .makeDirectory(destination, { recursive: true })
        .pipe(Effect.mapError(localError(destination, 'create')));
    } else {
      files.push({ remote: entry.path, local: destination });
    }

    let bytes = 0;
    for (const file of files) {
      const content = yield* Effect.tryPromise({
        try: () => client.microvms.files.read(source.microvmId, file.remote),
        catch: toApiRequestError,
      });
      yield* fs
        .makeDirectory(path.dirname(file.local), { recursive: true })
        .pipe(Effect.mapError(localError(file.local, 'create the directory of')));
      yield* fs.writeFile(file.local, content).pipe(Effect.mapError(localError(file.local, 'write')));
      bytes += content.length;
    }
    return { files: files.length, bytes };
  });

/**
 * Copies between the local machine and a microVM. Exactly one side is
 * `vm:<id>:<path>`. Directories are copied recursively; copying onto an
 * existing directory (or a path ending in `/`) puts the source inside it.
 */
export const copyFiles = (sourceSpec: string, targetSpec: string) =>
  Effect.gen(function* () {
    const source = yield* parseTarget(sourceSpec);
    const target = yield* parseTarget(targetSpec);
    const apiClient = yield* ApiClientService;
    const client = yield* apiClient.getClient;
    if (source.kind === 'local' && target.kind === 'remote') return yield* upload(client, source.path, target);
    if (source.kind === 'remote' && target.kind === 'local') return yield* download(client, source, target.path);
    return yield* new InvalidCopyTargetError({
      message: 'One side must be local and the other vm:<id>:<path>, e.g. "gigadrive microvms cp ./app vm:<id>:/app".',
    });
  });

const copyCommand = Command.make(
  'cp',
  {
    source: Args.text({ name: 'source' }).pipe(Args.withDescription('Local path or vm:<id>:<path>')),
    target: Args.text({ name: 'target' }).pipe(Args.withDescription('Local path or vm:<id>:<path>')),
  },
  ({ source, target }) =>
    copyFiles(source, target).pipe(
      Effect.flatMap((result) =>
        Console.log(`Copied ${result.files} file${result.files === 1 ? '' : 's'} (${formatBytes(result.bytes)}).`)
      ),
      reportErrors('copy')
    )
).pipe(Command.withDescription('Copy files between this machine and a microVM (vm:<id>:<path>)'));

// ---------------------------------------------------------------------------
// stop / rm / extend
// ---------------------------------------------------------------------------

const microvmIdsArg = Args.text({ name: 'microvm-id' }).pipe(
  Args.withDescription('One or more microVM IDs'),
  Args.atLeast(1)
);

const stopCommand = Command.make('stop', { microvmIds: microvmIdsArg }, ({ microvmIds }) =>
  Effect.forEach(
    microvmIds,
    (microvmId) =>
      Effect.gen(function* () {
        const apiClient = yield* ApiClientService;
        yield* apiClient.request((client) => client.microvms.stop(microvmId));
        yield* Console.log(`Stopped ${microvmId}.`);
      }),
    { discard: true }
  ).pipe(reportErrors('stop the microVM'))
).pipe(Command.withDescription('Stop microVMs; their disk and memory are discarded'));

const removeCommand = Command.make('rm', { microvmIds: microvmIdsArg }, ({ microvmIds }) =>
  Effect.forEach(
    microvmIds,
    (microvmId) =>
      Effect.gen(function* () {
        const apiClient = yield* ApiClientService;
        yield* apiClient.request((client) => client.microvms.delete(microvmId));
        yield* Console.log(`Deleted ${microvmId}.`);
      }),
    { discard: true }
  ).pipe(reportErrors('delete the microVM'))
).pipe(Command.withDescription('Delete microVMs, stopping them first'));

/** Sets a microVM's remaining lifetime. */
export const extendMicroVm = (microvmId: string, duration: string) =>
  Effect.gen(function* () {
    const timeoutMs = yield* parseLifetime('The duration', duration);
    const apiClient = yield* ApiClientService;
    const vm = yield* apiClient.request((client) => client.microvms.extendTimeout(microvmId, timeoutMs));
    yield* Console.log(`${vm.id} now stops at ${vm.expiresAt ?? 'an unknown time'}.`);
    return vm;
  });

const extendCommand = Command.make(
  'extend',
  {
    microvmId: microvmIdArg,
    duration: Args.text({ name: 'duration' }).pipe(
      Args.withDescription('New remaining lifetime from now, such as 30m')
    ),
  },
  ({ microvmId, duration }) =>
    extendMicroVm(microvmId, duration).pipe(Effect.asVoid, reportErrors('extend the microVM'))
).pipe(Command.withDescription('Keep a microVM running longer'));

// ---------------------------------------------------------------------------
// images
// ---------------------------------------------------------------------------

const imagesListCommand = Command.make('ls', { app: appOption, json: jsonOption }, ({ app, json }) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const applicationId = yield* resolveApplicationId(app);
    const images = yield* apiClient.request((client) => client.microvms.images.list({ applicationId }));
    if (json) return yield* Console.log(JSON.stringify(images, null, 2));
    for (const line of formatImageTable(images)) yield* Console.log(line);
  }).pipe(reportErrors('list images'))
).pipe(Command.withDescription('List built-in and custom images'));

/** Flags of `microvms images create`. */
export interface CreateImageFlags {
  readonly name: string;
  readonly app: Option.Option<string>;
  readonly from: Option.Option<string>;
  readonly dockerfile: Option.Option<string>;
  readonly wait: boolean;
  readonly json: boolean;
}

/** Starts a custom image build, optionally waiting for it. */
export const createImage = (flags: CreateImageFlags) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const apiClient = yield* ApiClientService;
    if (Option.isSome(flags.from) === Option.isSome(flags.dockerfile)) {
      return yield* new InvalidMicroVmOptionsError({
        message: 'Pass exactly one of --from <registry reference> or --dockerfile <path>.',
      });
    }
    const from = Option.isSome(flags.from)
      ? flags.from.value
      : {
          dockerfile: yield* fs.readFileString(Option.getOrElse(flags.dockerfile, () => 'Dockerfile')).pipe(
            Effect.mapError(
              localError(
                Option.getOrElse(flags.dockerfile, () => 'Dockerfile'),
                'read'
              )
            )
          ),
        };
    const applicationId = yield* resolveApplicationId(flags.app);
    let image: MicroVmImage = yield* apiClient.request((client) =>
      client.microvms.images.create({ name: flags.name, from, ...(applicationId ? { applicationId } : {}) })
    );
    if (flags.wait) {
      if (!flags.json) yield* Console.error(`Building ${image.name}...`);
      image = yield* apiClient.request((client) =>
        client.microvms.images.waitUntilReady(image.id, {
          onStatus: (current) => {
            if (!flags.json) process.stderr.write(`  ${current.status}\n`);
          },
        })
      );
    }
    if (flags.json) {
      yield* Console.log(JSON.stringify(image, null, 2));
    } else if (image.status === 'ready') {
      yield* Console.log(`${image.name} is ready. Use it with: gigadrive microvms create --image ${image.name}`);
    } else {
      yield* Console.log(
        `${image.name} is ${image.status} (${image.id}). Check it with "gigadrive microvms images ls".`
      );
    }
    return image;
  });

const imagesCreateCommand = Command.make(
  'create',
  {
    name: Args.text({ name: 'name' }).pipe(
      Args.withDescription('Image name: lowercase letters, digits, ".", "_", "-"')
    ),
    app: appOption,
    from: Options.text('from').pipe(
      Options.withDescription('Public linux/amd64 registry image, such as python:3.13 or ghcr.io/acme/tool:1'),
      Options.optional
    ),
    dockerfile: Options.text('dockerfile').pipe(
      Options.withAlias('f'),
      Options.withDescription('Build from this Dockerfile instead'),
      Options.optional
    ),
    wait: Options.boolean('wait').pipe(Options.withDescription('Wait until the build finished')),
    json: jsonOption,
  },
  (flags) => createImage(flags).pipe(Effect.asVoid, reportErrors('create the image'))
).pipe(Command.withDescription('Build a custom image from a registry image or a Dockerfile'));

/** Deletes a custom image by ID or name. */
export const removeImage = (idOrName: string, app: Option.Option<string>) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const applicationId = yield* resolveApplicationId(app);
    const images = yield* apiClient.request((client) => client.microvms.images.list({ applicationId }));
    const image = images.find((candidate) => candidate.id === idOrName) ??
      images.find((candidate) => !candidate.builtin && candidate.name === idOrName) ?? { id: idOrName, name: idOrName };
    yield* apiClient.request((client) => client.microvms.images.delete(image.id));
    yield* Console.log(`Deleted image ${image.name}.`);
  });

const imagesRemoveCommand = Command.make(
  'rm',
  {
    image: Args.text({ name: 'image' }).pipe(Args.withDescription('Image ID or name')),
    app: appOption,
  },
  ({ image, app }) => removeImage(image, app).pipe(reportErrors('delete the image'))
).pipe(Command.withDescription('Delete a custom image'));

const imagesCommand = Command.make('images', {}, () => Effect.void).pipe(
  Command.withDescription('Built-in and custom microVM images'),
  Command.withSubcommands([imagesListCommand, imagesCreateCommand, imagesRemoveCommand])
);

// ---------------------------------------------------------------------------
// microvms (parent)
// ---------------------------------------------------------------------------

const SUBCOMMANDS = [
  createCommand,
  listCommand,
  getCommand,
  execCommand,
  shellCommand,
  copyCommand,
  stopCommand,
  removeCommand,
  extendCommand,
  imagesCommand,
] as const;

/** `gigadrive microvms`: create microVMs, run commands and shells in them, copy files, manage images. */
export const microvmsCommand = Command.make('microvms', {}, () => Effect.void).pipe(
  Command.withDescription('Isolated Linux machines for running code: create, exec, shell, cp, stop'),
  Command.withSubcommands(SUBCOMMANDS)
);

/** `gigadrive vm`: alias of {@link microvmsCommand}. */
export const vmCommand = Command.make('vm', {}, () => Effect.void).pipe(
  Command.withDescription('Alias of "gigadrive microvms"'),
  Command.withSubcommands(SUBCOMMANDS)
);

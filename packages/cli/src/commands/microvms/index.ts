import { Args, Command, Options } from '@effect/cli';
import { FileSystem, Path } from '@effect/platform';
import {
  type CreatedMicroVmInfo,
  type CreateMicroVmInput,
  durationToMs,
  type FileEntry,
  type GigadriveClient,
  MicroVM,
  MICROVM_MAX_TIMEOUT_MS,
  MICROVM_TRANSITIONAL_STATUSES,
  type MicroVmDuration,
  type MicroVmImage,
  type MicroVmInfo,
  type MicroVmInjectRule,
  type MicroVmMetrics,
  type MicroVmSnapshot,
  type MicroVmStatus,
  MicroVmTimeoutError,
  type MicroVmVolumeAttachment,
  type MicroVmWebhookEventType,
} from '@gigadrive/sdk';
import { Config, Console, type Duration, Effect, Exit, Option, Schedule } from 'effect';
import {
  ApiRequestError,
  InvalidCopyTargetError,
  InvalidMicroVmOptionsError,
  LocalFileError,
  MicroVmStateError,
  TerminalRequiredError,
} from '../../errors';
import {
  type CopyTarget,
  describeMicroVm,
  exitStatusOf,
  formatBytes,
  formatDeliveryTable,
  formatImageTable,
  formatMicroVmTable,
  formatSnapshotTable,
  formatVolumeTable,
  formatWebhookTable,
  parseCopyTarget,
  parseKeyValues,
  posixBasename,
  posixJoin,
  relativeTo,
} from '../../lib/microvm';
import { attachCommand, nodeSessionIo, type SessionIo } from '../../lib/microvm-session';
import { createProgress, type ProgressStream } from '../../lib/progress';
import { ApiClientService, toApiRequestError } from '../../services/api-client';
import { ProjectLinkService } from '../../services/project-link';

const CONSOLE_URL = 'https://console.gigadrive.de';

const MICROVM_STATUSES = [
  'pending',
  'starting',
  'running',
  'pausing',
  'paused',
  'resuming',
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
      if (/applicationId.+required/i.test(error.message)) {
        return 'No application selected. Pass --app <id> or run "gigadrive link" in your project directory.';
      }
      if (/should be uuid|must be a valid uuid|format.+uuid/i.test(error.message)) {
        return `Failed to ${action}: an ID is not in the right format. IDs look like 0197b2f1-2f4a-7a0b-8a2d-444444444444; list them with "gigadrive microvms ls".`;
      }
      if (error.code === 'microvm_paused') {
        return `${error.message}\nThe microVM is paused. Run "gigadrive microvms resume <id>", then retry.`;
      }
      if (error.statusCode === 404) {
        return `Failed to ${action}: ${error.message}. Check the ID with "gigadrive microvms ls" (or "gigadrive microvms snapshots ls" for a snapshot).`;
      }
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
      if (error.statusCode === 401) {
        return `Failed to ${action}: your login expired. Run "gigadrive login".`;
      }
      if (error.statusCode === 403) {
        return `Failed to ${action}: ${error.message}. Check that you can use this application, or log in again with "gigadrive login".`;
      }
      return `Failed to ${action}: ${error.message}`;
    default:
      return error.message;
  }
};

/** A microVM, snapshot or volume ID. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Refuses an argument that cannot be a microVM or snapshot ID before any request is sent. */
export const requireId = (kind: 'microVM' | 'snapshot', id: string) =>
  UUID.test(id)
    ? Effect.succeed(id)
    : Effect.fail(
        new InvalidMicroVmOptionsError({
          message:
            kind === 'microVM'
              ? `${id} is not a microVM ID. List your microVMs with "gigadrive microvms ls".`
              : `${id} is not a snapshot ID. List your snapshots with "gigadrive microvms snapshots ls".`,
        })
      );

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
  readonly vcpus: Option.Option<'1' | '2' | '4'>;
  readonly memory: Option.Option<number>;
  readonly disk: Option.Option<number>;
  readonly timeout: Option.Option<string>;
  /** `--port` values as typed; {@link createInput} checks each one. */
  readonly ports: ReadonlyArray<string>;
  readonly env: ReadonlyArray<string>;
  readonly metadata: ReadonlyArray<string>;
  readonly denyEgress: boolean;
  readonly privatePreviews: boolean;
  readonly allowEgress: ReadonlyArray<string>;
  readonly inject: ReadonlyArray<string>;
  readonly injectFile: Option.Option<string>;
  readonly pauseOnTimeout: boolean;
  readonly autoResume: boolean;
  readonly volumes: ReadonlyArray<string>;
  readonly region: Option.Option<string>;
  readonly json: boolean;
  /** `--no-wait`: return what the API answered, even when the microVM is still `pending`. */
  readonly noWait?: boolean;
  /** `--wait-timeout`: how long to wait for the microVM to run. Default 8 minutes. */
  readonly waitTimeout?: Option.Option<string>;
  /** Create from this snapshot instead of an image (`microvms fork`). */
  readonly snapshotId?: string;
}

/**
 * Parses `--port` values: whole numbers from 1 to 65535. They are read as
 * text so a malformed value gets a clear message instead of being dropped.
 */
export const parsePorts = (values: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const ports: number[] = [];
    for (const value of values) {
      const port = /^\d{1,5}$/.test(value.trim()) ? Number(value.trim()) : Number.NaN;
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return yield* new InvalidMicroVmOptionsError({
          message: `--port must be a whole number from 1 to 65535, such as --port 3000 (got "${value}").`,
        });
      }
      if (!ports.includes(port)) ports.push(port);
    }
    return ports;
  });

/**
 * Parses `--volume VOLUME:PATH` (a volume ID or name, then an absolute mount
 * path). The API checks the path rules; this only catches the obvious typos.
 */
export const parseVolumeFlags = (values: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (values.length > 4) {
      return yield* new InvalidMicroVmOptionsError({ message: '--volume takes at most 4 volumes.' });
    }
    const volumes: MicroVmVolumeAttachment[] = [];
    for (const value of values) {
      const separator = value.indexOf(':');
      const volumeId = separator > 0 ? value.slice(0, separator) : '';
      const mountPath = separator > 0 ? value.slice(separator + 1) : '';
      if (volumeId === '' || !mountPath.startsWith('/')) {
        return yield* new InvalidMicroVmOptionsError({
          message: `--volume must be VOLUME:PATH with an absolute path, such as cache:/cache (got ${value}).`,
        });
      }
      volumes.push({ volumeId, mountPath });
    }
    return volumes;
  });

/**
 * Parses `--inject DOMAIN:HEADER=VALUE` into rules, one per domain. The API
 * checks the header rules; this only catches the obvious typos.
 */
export const parseInjectFlags = (values: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const rules = new Map<string, Record<string, string>>();
    for (const value of values) {
      const colon = value.indexOf(':');
      const equals = value.indexOf('=', colon + 1);
      const domain = colon > 0 ? value.slice(0, colon).trim().toLowerCase() : '';
      const name = colon > 0 && equals > colon ? value.slice(colon + 1, equals).trim() : '';
      if (domain === '' || name === '' || equals === value.length - 1) {
        return yield* new InvalidMicroVmOptionsError({
          // The entry is not echoed: it may hold the credential.
          message:
            '--inject and --inject-file take DOMAIN:HEADER=VALUE, such as "api.openai.com:Authorization=Bearer $OPENAI_API_KEY".',
        });
      }
      rules.set(domain, { ...rules.get(domain), [name]: value.slice(equals + 1) });
    }
    if (rules.size > 8) {
      return yield* new InvalidMicroVmOptionsError({ message: '--inject takes at most 8 domains.' });
    }
    return [...rules].map(([domain, headers]): MicroVmInjectRule => ({ domain, headers }));
  });

/**
 * Parses `--inject` together with the lines of `--inject-file`, one
 * DOMAIN:HEADER=VALUE per line (blank lines and `#` comments skipped). A file
 * keeps the credential out of the process arguments, which other users of the
 * machine can read; `/dev/stdin` reads it from a pipe.
 */
const readInjectRules = (inject: ReadonlyArray<string>, injectFile: Option.Option<string>) =>
  Effect.gen(function* () {
    if (Option.isNone(injectFile)) return yield* parseInjectFlags(inject);
    const fs = yield* FileSystem.FileSystem;
    const content = yield* fs
      .readFileString(injectFile.value)
      .pipe(
        Effect.mapError(
          () => new InvalidMicroVmOptionsError({ message: `Could not read --inject-file ${injectFile.value}.` })
        )
      );
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'));
    return yield* parseInjectFlags([...inject, ...lines]);
  });

/** Checks `--deny-egress` and `--allow-egress` before any request is sent. */
const checkEgressFlags = (denyEgress: boolean, allowEgress: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (denyEgress && allowEgress.length > 0) {
      return yield* new InvalidMicroVmOptionsError({
        message: '--allow-egress cannot be combined with --deny-egress.',
      });
    }
    if (allowEgress.length > 32) {
      return yield* new InvalidMicroVmOptionsError({ message: '--allow-egress takes at most 32 entries.' });
    }
    // The shape only: the API refuses private and reserved ranges and
    // malformed names, so those rules live in one place.
    const network = /^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/;
    const domain = /^(\*\.)?([a-z0-9-]+\.)+[a-z0-9-]*[a-z][a-z0-9-]*\.?$/i;
    const badEntry = allowEgress.find((entry) => !network.test(entry.trim()) && !domain.test(entry.trim()));
    if (badEntry !== undefined) {
      return yield* new InvalidMicroVmOptionsError({
        message: `--allow-egress must be a domain name such as api.openai.com or *.github.com, or an IPv4 network such as 140.82.112.0/20 (got ${badEntry}).`,
      });
    }
  });

/** Turns `create` flags into the API body. */
export const createInput = (flags: CreateFlags) =>
  Effect.gen(function* () {
    const env = yield* keyValues('--env', flags.env);
    const metadata = yield* keyValues('--metadata', flags.metadata);
    const timeoutMs = yield* Option.match(flags.timeout, {
      onNone: () => Effect.succeed(undefined),
      onSome: (text) => parseLifetime('--timeout', text),
    });
    yield* checkEgressFlags(flags.denyEgress, flags.allowEgress);
    const ports = yield* parsePorts(flags.ports);
    const inject = yield* readInjectRules(flags.inject, flags.injectFile);
    if (inject.length > 0 && flags.denyEgress) {
      return yield* new InvalidMicroVmOptionsError({ message: '--inject cannot be combined with --deny-egress.' });
    }
    const volumes = yield* parseVolumeFlags(flags.volumes);
    if (volumes.length > 0 && flags.pauseOnTimeout) {
      return yield* new InvalidMicroVmOptionsError({ message: '--volume cannot be combined with --pause-on-timeout.' });
    }
    const applicationId = yield* resolveApplicationId(flags.app);
    const input: CreateMicroVmInput = {
      ...(applicationId ? { applicationId } : {}),
      ...(flags.snapshotId !== undefined ? { snapshotId: flags.snapshotId } : {}),
      ...Option.match(flags.image, { onNone: () => ({}), onSome: (image) => ({ image }) }),
      ...Option.match(flags.vcpus, {
        onNone: () => ({}),
        onSome: (vcpus) => ({ vcpus: Number(vcpus) as 1 | 2 | 4 }),
      }),
      ...Option.match(flags.memory, { onNone: () => ({}), onSome: (memoryMb) => ({ memoryMb }) }),
      ...Option.match(flags.disk, { onNone: () => ({}), onSome: (diskMb) => ({ diskMb }) }),
      ...(timeoutMs !== undefined ? { timeoutMs } : {}),
      ...(flags.pauseOnTimeout ? { onTimeout: 'pause' as const } : {}),
      ...(flags.autoResume ? { autoResume: true } : {}),
      ...(ports.length > 0 ? { ports } : {}),
      ...(env ? { env } : {}),
      ...(metadata ? { metadata } : {}),
      ...(volumes.length > 0 ? { volumes } : {}),
      ...(flags.denyEgress || flags.privatePreviews || flags.allowEgress.length > 0 || inject.length > 0
        ? {
            network: {
              egress: flags.denyEgress ? ('deny' as const) : ('allow' as const),
              ...(flags.privatePreviews ? { previews: 'private' as const } : {}),
              ...(flags.allowEgress.length > 0 ? { allow: flags.allowEgress.map((entry) => entry.trim()) } : {}),
              ...(inject.length > 0 ? { inject } : {}),
            },
          }
        : {}),
      ...Option.match(flags.region, { onNone: () => ({}), onSome: (region) => ({ region }) }),
    };
    return input;
  });

/** How long a command waits for a microVM or snapshot to settle by default: the API's longest capacity wait. */
const DEFAULT_WAIT_TIMEOUT = '8m';

const waitTimeoutOption = Options.text('wait-timeout').pipe(
  Options.withDescription('Give up waiting after this long, such as 2m or 15m (default: 8m)'),
  Options.optional
);

/** The progress line for a microVM in a status that changes on its own. */
const waitingMessage = (status: MicroVmStatus) => {
  switch (status) {
    case 'pending':
      return 'Waiting for capacity...';
    case 'starting':
      return 'Starting...';
    case 'pausing':
      return 'Pausing...';
    case 'resuming':
      return 'Resuming...';
    case 'stopping':
      return 'Stopping...';
    default:
      return `${status}...`;
  }
};

/** Where waits report progress and how often they poll; tests shorten both. */
export interface WaitIo {
  /** Default stderr. */
  readonly stream?: ProgressStream;
  /** Default 1s. */
  readonly pollInterval?: MicroVmDuration;
}

/**
 * Runs an SDK wait, which may take minutes: interrupting the command (Ctrl-C)
 * aborts it, and running out of time becomes a {@link MicroVmStateError} that
 * says what to do next.
 */
const runWait = <A>(
  run: (client: GigadriveClient, signal: AbortSignal) => Promise<A>,
  onTimeout: () => MicroVmStateError
) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const client = yield* apiClient.getClient;
    return yield* Effect.tryPromise({
      try: (signal) => run(client, signal),
      catch: (error) => (error instanceof MicroVmTimeoutError ? onTimeout() : toApiRequestError(error)),
    });
  });

/**
 * Polls a microVM until its status stops changing on its own (`pending`,
 * `starting`, `pausing`, `resuming`, `stopping`), with a progress line on
 * stderr. A microVM that already settled is returned as is.
 */
export const settleMicroVm = (vm: MicroVmInfo, waitTimeout: Option.Option<string>, io: WaitIo = {}) =>
  Effect.gen(function* () {
    if (!MICROVM_TRANSITIONAL_STATUSES.includes(vm.status)) return vm;
    const timeoutText = Option.getOrElse(waitTimeout, () => DEFAULT_WAIT_TIMEOUT);
    const timeout = yield* parseDuration('--wait-timeout', timeoutText);
    const progress = createProgress(io.stream);
    let last = vm;
    progress.update(waitingMessage(vm.status), 0);
    return yield* runWait(
      (client, signal) =>
        client.microvms.waitUntilSettled(vm.id, {
          timeout,
          interval: io.pollInterval ?? '1s',
          signal,
          onPoll: (current, elapsedMs) => {
            last = current;
            progress.update(waitingMessage(current.status), elapsedMs);
          },
        }),
      () =>
        new MicroVmStateError({
          message: `The microVM ${vm.id} is still ${last.status} after ${timeoutText}. It keeps going in the background: check it with "gigadrive microvms get ${vm.id}", or delete it with "gigadrive microvms rm ${vm.id}".`,
          resourceId: vm.id,
          status: last.status,
        })
    ).pipe(Effect.ensuring(Effect.sync(() => progress.done())));
  });

/** Polls a snapshot until it is no longer `creating`, with a progress line on stderr. */
export const settleSnapshot = (snapshot: MicroVmSnapshot, waitTimeout: Option.Option<string>, io: WaitIo = {}) =>
  Effect.gen(function* () {
    if (snapshot.status !== 'creating') return snapshot;
    const timeoutText = Option.getOrElse(waitTimeout, () => DEFAULT_WAIT_TIMEOUT);
    const timeout = yield* parseDuration('--wait-timeout', timeoutText);
    const progress = createProgress(io.stream);
    progress.update('Taking the snapshot...', 0);
    return yield* runWait(
      (client, signal) =>
        client.microvms.snapshots.waitUntilSettled(snapshot.id, {
          timeout,
          interval: io.pollInterval ?? '1s',
          signal,
          onPoll: (_current, elapsedMs) => progress.update('Taking the snapshot...', elapsedMs),
        }),
      () =>
        new MicroVmStateError({
          message: `The snapshot ${snapshot.id} is still being created after ${timeoutText}. Check it with "gigadrive microvms snapshots get ${snapshot.id}".`,
          resourceId: snapshot.id,
          status: 'creating',
        })
    ).pipe(Effect.ensuring(Effect.sync(() => progress.done())));
  });

/**
 * Creates a microVM, waits until it runs (unless `--no-wait`) and prints it.
 * A microVM that failed to start fails the command with its stop reason.
 */
export const createMicroVm = (flags: CreateFlags, io: WaitIo = {}) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const parsed = yield* createInput(flags);
    // `--volume` takes a name too: resolve names against the application's volumes.
    const named = (parsed.volumes ?? []).filter((volume) => !UUID.test(volume.volumeId));
    const known =
      named.length > 0
        ? yield* apiClient.request((client) =>
            client.microvms.volumes.list({ ...(parsed.applicationId ? { applicationId: parsed.applicationId } : {}) })
          )
        : [];
    const volumes: MicroVmVolumeAttachment[] = [];
    for (const volume of parsed.volumes ?? []) {
      if (UUID.test(volume.volumeId)) {
        volumes.push(volume);
        continue;
      }
      const match = known.find((entry) => entry.name === volume.volumeId);
      if (match === undefined) {
        return yield* new InvalidMicroVmOptionsError({
          message: `No volume is named ${volume.volumeId}. Create it with "gigadrive microvms volumes create ${volume.volumeId}".`,
        });
      }
      volumes.push({ volumeId: match.id, mountPath: volume.mountPath });
    }
    const input: CreateMicroVmInput = volumes.length > 0 ? { ...parsed, volumes } : parsed;
    if (!flags.json) {
      yield* Console.error(
        input.snapshotId !== undefined
          ? `Creating a microVM from snapshot ${input.snapshotId}...`
          : `Creating a microVM from ${input.image ?? 'node22'}...`
      );
    }
    // The API answers within about 25 seconds: `running`, or `pending` while it
    // still waits for capacity (202). Wait for the rest here.
    const created = yield* apiClient.request((client) => client.microvms.create(input));
    const settled =
      flags.noWait === true ? created : yield* settleMicroVm(created, flags.waitTimeout ?? Option.none(), io);
    const vm: CreatedMicroVmInfo = created.previewToken ? { ...settled, previewToken: created.previewToken } : settled;
    if (flags.json) yield* Console.log(JSON.stringify(vm, null, 2));
    if (vm.status === 'failed' || vm.status === 'stopped') {
      return yield* new MicroVmStateError({
        message: `The microVM ${vm.id} ${vm.status === 'failed' ? 'failed to start' : 'stopped before it ran'}${
          vm.stopReason ? `: ${vm.stopReason}` : ''
        }. Try again, or pick another --region.`,
        resourceId: vm.id,
        status: vm.status,
      });
    }
    if (flags.json) return vm;
    for (const line of describeMicroVm(vm)) yield* Console.log(line);
    if (vm.status !== 'running') {
      yield* Console.log(`\nIt is still ${vm.status}. Check it with "gigadrive microvms get ${vm.id}".`);
    }
    if (vm.previewToken) {
      yield* Console.log(`\nPreview token: ${vm.previewToken}`);
      yield* Console.log(
        'Shown only now. Send it in the x-gigadrive-preview-token header, or open a preview URL once with ?gd_preview_token=<token>.'
      );
    }
    yield* Console.log(`\nRun a command: gigadrive microvms exec ${vm.id} -- <command>`);
    yield* Console.log(`Open a shell:  gigadrive microvms shell ${vm.id}`);
    return vm;
  });

/** Options of `microvms create`; `microvms fork` takes those that make sense for a snapshot. */
const createOptions = {
  app: appOption,
  image: Options.text('image').pipe(
    Options.withAlias('i'),
    Options.withDescription(
      'Image name or ID: node22, node24, python3.13, python3.12, bun1, debian12, ubuntu24.04, or a custom image (default: node22)'
    ),
    Options.optional
  ),
  vcpus: Options.choice('vcpus', ['1', '2', '4'] as const).pipe(
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
  ports: Options.text('port').pipe(
    Options.withAlias('p'),
    Options.withDescription('Port to expose on a preview URL, 1 to 65535 (repeatable, up to 8)'),
    Options.repeated
  ),
  env: envOption,
  metadata: Options.text('metadata').pipe(
    Options.withAlias('m'),
    Options.withDescription('Metadata as KEY=VALUE (repeatable)'),
    Options.repeated
  ),
  denyEgress: Options.boolean('deny-egress').pipe(Options.withDescription('Block all outbound network traffic')),
  privatePreviews: Options.boolean('private-previews').pipe(
    Options.withDescription('Answer preview URLs only to requests that carry the preview token printed at create')
  ),
  allowEgress: Options.text('allow-egress').pipe(
    Options.withDescription(
      'Only reach this domain name (api.openai.com, *.github.com for every subdomain) or public IPv4 network (140.82.112.0/20) (repeatable, up to 32)'
    ),
    Options.repeated
  ),
  inject: Options.text('inject').pipe(
    Options.withDescription(
      'Add a header to HTTPS requests to a domain, as DOMAIN:HEADER=VALUE (repeatable, up to 8 domains); the value never enters the microVM'
    ),
    Options.repeated
  ),
  injectFile: Options.text('inject-file').pipe(
    Options.withDescription(
      'Read --inject rules from a file, one DOMAIN:HEADER=VALUE per line (/dev/stdin for a pipe), so the values stay out of the command line'
    ),
    Options.optional
  ),
  pauseOnTimeout: Options.boolean('pause-on-timeout').pipe(
    Options.withDescription('Pause the microVM when its timeout ends instead of stopping it')
  ),
  autoResume: Options.boolean('auto-resume').pipe(
    Options.withDescription('Resume the paused microVM when a command, file call or public preview request reaches it')
  ),
  volumes: Options.text('volume').pipe(
    Options.withAlias('v'),
    Options.withDescription(
      'Attach a volume as VOLUME:PATH, by ID or name, such as cache:/cache (repeatable, up to 4; saved when the microVM stops)'
    ),
    Options.repeated
  ),
  region: Options.text('region').pipe(Options.withDescription('Region to place the microVM in'), Options.optional),
  json: jsonOption,
  noWait: Options.boolean('no-wait').pipe(
    Options.withDescription('Return as soon as the API answers, even while the microVM still waits for capacity')
  ),
  waitTimeout: waitTimeoutOption,
};

const createCommand = Command.make('create', createOptions, (flags) =>
  createMicroVm(flags).pipe(Effect.asVoid, reportErrors('create the microVM'))
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
    yield* requireId('microVM', microvmId);
    const apiClient = yield* ApiClientService;
    const vm = yield* apiClient.request((client) => client.microvms.get(microvmId));
    if (json) return yield* Console.log(JSON.stringify(vm, null, 2));
    for (const line of describeMicroVm(vm)) yield* Console.log(line);
  }).pipe(reportErrors('get the microVM'))
).pipe(Command.withDescription('Show a microVM'));

const formatGigabytes = (bytes: number) => `${(bytes / 1_000_000_000).toFixed(1)} GB`;

/** The lines `microvms metrics` prints for a microVM's metrics. */
export const describeMicroVmMetrics = (metrics: MicroVmMetrics): string[] => {
  const latest = metrics.cpu.at(-1);
  const peak = metrics.cpu.reduce((max, point) => Math.max(max, point.cpuPercent), 0);
  return [
    `CPU (last ${metrics.windowMinutes} min, ${metrics.vcpus} vCPU): ${
      latest ? `${latest.cpuPercent}% at ${latest.time}, peak ${peak}%` : 'no samples'
    }`,
    metrics.current
      ? `Memory: ${formatGigabytes(metrics.current.memoryUsedBytes)} of ${formatGigabytes(metrics.current.memoryTotalBytes)}`
      : 'Memory: unavailable (not running, or no answer)',
    metrics.current
      ? `Disk:   ${formatGigabytes(metrics.current.diskUsedBytes)} of ${formatGigabytes(metrics.current.diskTotalBytes)}`
      : 'Disk:   unavailable (not running, or no answer)',
  ];
};

const metricsCommand = Command.make(
  'metrics',
  {
    microvmId: microvmIdArg,
    window: Options.integer('window').pipe(
      Options.withDescription('Minutes of CPU history, 1 to 1440 (default: 15)'),
      Options.optional
    ),
    json: jsonOption,
  },
  ({ microvmId, window, json }) =>
    Effect.gen(function* () {
      yield* requireId('microVM', microvmId);
      const apiClient = yield* ApiClientService;
      const windowMinutes = Option.getOrUndefined(window);
      const metrics = yield* apiClient.request((client) =>
        client.microvms.getMetrics(microvmId, windowMinutes === undefined ? {} : { windowMinutes })
      );
      if (json) return yield* Console.log(JSON.stringify(metrics, null, 2));
      for (const line of describeMicroVmMetrics(metrics)) yield* Console.log(line);
    }).pipe(reportErrors('read the microVM metrics'))
).pipe(Command.withDescription("Show a microVM's CPU, memory and disk use"));

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
  (flags) =>
    requireId('microVM', flags.microvmId).pipe(
      Effect.andThen(execInMicroVm(flags)),
      Effect.flatMap(setExitCode),
      reportErrors('run the command')
    )
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
  (flags) =>
    requireId('microVM', flags.microvmId).pipe(
      Effect.andThen(openShell(flags)),
      Effect.flatMap(setExitCode),
      reportErrors('open a shell')
    )
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

/** Options of {@link copyFiles}. */
export interface CopyOptions {
  /** Files in flight at once. Default 8. */
  readonly concurrency?: number;
  /** Where the progress line goes. Default stderr. */
  readonly progress?: ProgressStream;
  /** First delay before retrying a file that failed with a transient error. Default 250 ms, doubled per retry. */
  readonly retryDelay?: Duration.DurationInput;
}

/** Default number of files `cp` transfers at once. */
export const DEFAULT_COPY_CONCURRENCY = 8;

/** How often `cp` retries one file after a transient error. */
const COPY_RETRIES = 4;

/** A failure worth retrying: no answer at all, a busy microVM, or a server error. */
export const isTransientCopyError = (error: ApiRequestError | LocalFileError) =>
  error._tag === 'ApiRequestError' &&
  (error.statusCode === undefined || error.statusCode === 429 || error.statusCode >= 500);

/**
 * Transfers files with at most `concurrency` requests in flight, retrying
 * each file on transient errors with exponential backoff, and reports
 * progress on stderr for more than one file.
 */
const transferAll = <F, E extends ApiRequestError | LocalFileError, R>(
  files: ReadonlyArray<F>,
  verb: 'Uploaded' | 'Downloaded',
  options: CopyOptions,
  transfer: (file: F) => Effect.Effect<number, E, R>
) =>
  Effect.gen(function* () {
    const progress = createProgress(options.progress ?? process.stderr);
    const started = Date.now();
    let done = 0;
    let bytes = 0;
    const retry = Schedule.exponential(options.retryDelay ?? '250 millis').pipe(
      Schedule.jittered,
      Schedule.intersect(Schedule.recurs(COPY_RETRIES))
    );
    yield* Effect.forEach(
      files,
      (file) =>
        transfer(file).pipe(
          Effect.retry({ schedule: retry, while: isTransientCopyError }),
          Effect.tap((size) =>
            Effect.sync(() => {
              done += 1;
              bytes += size;
              if (files.length > 1) {
                progress.update(`${verb} ${done}/${files.length} files, ${formatBytes(bytes)}`, Date.now() - started);
              }
            })
          )
        ),
      { concurrency: options.concurrency ?? DEFAULT_COPY_CONCURRENCY, discard: true }
    ).pipe(Effect.ensuring(Effect.sync(() => progress.done())));
    return { files: files.length, bytes };
  });

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
const upload = (
  client: GigadriveClient,
  source: string,
  target: Extract<CopyTarget, { kind: 'remote' }>,
  options: CopyOptions
) =>
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

    return yield* transferAll(files, 'Uploaded', options, (file) =>
      Effect.gen(function* () {
        const content = yield* fs.readFile(file.local).pipe(Effect.mapError(localError(file.local, 'read')));
        const result = yield* Effect.tryPromise({
          try: (signal) => client.microvms.files.write(target.microvmId, file.remote, content, { signal }),
          catch: toApiRequestError,
        });
        return result.bytes;
      })
    );
  });

/** Copies a file or directory out of a microVM. */
const download = (
  client: GigadriveClient,
  source: Extract<CopyTarget, { kind: 'remote' }>,
  target: string,
  options: CopyOptions
) =>
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
        const segments = relativeTo(entry.path, child.path).split('/');
        // The listing comes from the microVM, which may run untrusted code:
        // never let an entry write outside the destination.
        if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
          yield* Console.error(`Skipped ${child.path}: its path leaves ${entry.path}.`);
          continue;
        }
        files.push({ remote: child.path, local: path.join(destination, ...segments) });
      }
      yield* fs
        .makeDirectory(destination, { recursive: true })
        .pipe(Effect.mapError(localError(destination, 'create')));
    } else {
      files.push({ remote: entry.path, local: destination });
    }

    return yield* transferAll(files, 'Downloaded', options, (file) =>
      Effect.gen(function* () {
        const content = yield* Effect.tryPromise({
          try: (signal) => client.microvms.files.read(source.microvmId, file.remote, { signal }),
          catch: toApiRequestError,
        });
        yield* fs
          .makeDirectory(path.dirname(file.local), { recursive: true })
          .pipe(Effect.mapError(localError(file.local, 'create the directory of')));
        yield* fs.writeFile(file.local, content).pipe(Effect.mapError(localError(file.local, 'write')));
        return content.length;
      })
    );
  });

/**
 * Copies between the local machine and a microVM. Exactly one side is
 * `vm:<id>:<path>`. Directories are copied recursively; copying onto an
 * existing directory (or a path ending in `/`) puts the source inside it.
 */
export const copyFiles = (sourceSpec: string, targetSpec: string, options: CopyOptions = {}) =>
  Effect.gen(function* () {
    const source = yield* parseTarget(sourceSpec);
    const target = yield* parseTarget(targetSpec);
    const concurrency = options.concurrency ?? DEFAULT_COPY_CONCURRENCY;
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 64) {
      return yield* new InvalidMicroVmOptionsError({
        message: `--concurrency must be a whole number from 1 to 64 (got ${concurrency}).`,
      });
    }
    const apiClient = yield* ApiClientService;
    const client = yield* apiClient.getClient;
    if (source.kind === 'local' && target.kind === 'remote') return yield* upload(client, source.path, target, options);
    if (source.kind === 'remote' && target.kind === 'local') {
      return yield* download(client, source, target.path, options);
    }
    return yield* new InvalidCopyTargetError({
      message: 'One side must be local and the other vm:<id>:<path>, e.g. "gigadrive microvms cp ./app vm:<id>:/app".',
    });
  });

const copyCommand = Command.make(
  'cp',
  {
    source: Args.text({ name: 'source' }).pipe(Args.withDescription('Local path or vm:<id>:<path>')),
    target: Args.text({ name: 'target' }).pipe(Args.withDescription('Local path or vm:<id>:<path>')),
    concurrency: Options.integer('concurrency').pipe(
      Options.withDescription(`Files to copy at once, 1 to 64 (default: ${DEFAULT_COPY_CONCURRENCY})`),
      Options.withDefault(DEFAULT_COPY_CONCURRENCY)
    ),
  },
  ({ source, target, concurrency }) =>
    copyFiles(source, target, { concurrency }).pipe(
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
        yield* requireId('microVM', microvmId);
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
        yield* requireId('microVM', microvmId);
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
    requireId('microVM', microvmId).pipe(
      Effect.andThen(extendMicroVm(microvmId, duration)),
      Effect.asVoid,
      reportErrors('extend the microVM')
    )
).pipe(Command.withDescription('Set how long a microVM keeps running, counted from now'));

/** Flags of `microvms network`. */
export interface NetworkFlags {
  readonly denyEgress: boolean;
  readonly allowEgress: ReadonlyArray<string>;
  readonly allowAllEgress: boolean;
  readonly inject: ReadonlyArray<string>;
  readonly injectFile: Option.Option<string>;
  readonly clearInject: boolean;
}

/** Replaces what a running or paused microVM may reach. */
export const updateMicroVmNetwork = (microvmId: string, flags: NetworkFlags) =>
  Effect.gen(function* () {
    const chosen = [flags.denyEgress, flags.allowEgress.length > 0, flags.allowAllEgress].filter(Boolean).length;
    // Egress is always explicit: `--inject` alone would silently drop an allowlist.
    if (chosen !== 1) {
      return yield* new InvalidMicroVmOptionsError({
        message: 'Pass exactly one of --deny-egress, --allow-egress or --allow-all-egress.',
      });
    }
    yield* checkEgressFlags(flags.denyEgress, flags.allowEgress);
    const inject = yield* readInjectRules(flags.inject, flags.injectFile);
    if (inject.length > 0 && flags.denyEgress) {
      return yield* new InvalidMicroVmOptionsError({ message: '--inject cannot be combined with --deny-egress.' });
    }
    if (flags.clearInject && (inject.length > 0 || flags.denyEgress)) {
      return yield* new InvalidMicroVmOptionsError({
        message: '--clear-inject cannot be combined with --inject or --deny-egress.',
      });
    }
    const apiClient = yield* ApiClientService;
    const vm = yield* apiClient.request((client) =>
      client.microvms.updateNetwork(
        microvmId,
        flags.denyEgress
          ? { egress: 'deny' }
          : {
              egress: 'allow',
              ...(flags.allowEgress.length > 0 ? { allow: flags.allowEgress.map((entry) => entry.trim()) } : {}),
              ...(inject.length > 0 || flags.clearInject ? { inject } : {}),
            }
      )
    );
    const reach =
      vm.network.egress === 'deny'
        ? 'no outbound traffic'
        : vm.network.allow
          ? vm.network.allow.join(', ')
          : 'the whole internet';
    yield* Console.log(`${vm.id} now reaches ${reach}.`);
    for (const rule of vm.network.inject ?? []) {
      yield* Console.log(`Adds ${rule.headers.join(', ')} to HTTPS requests to ${rule.domain}.`);
    }
    return vm;
  });

const networkCommand = Command.make(
  'network',
  {
    microvmId: microvmIdArg,
    denyEgress: Options.boolean('deny-egress').pipe(Options.withDescription('Block all outbound network traffic')),
    allowEgress: Options.text('allow-egress').pipe(
      Options.withDescription(
        'Only reach this domain name (api.openai.com, *.github.com for every subdomain) or public IPv4 network (140.82.112.0/20) (repeatable, up to 32)'
      ),
      Options.repeated
    ),
    allowAllEgress: Options.boolean('allow-all-egress').pipe(
      Options.withDescription('Reach the whole internet again (private networks stay blocked)')
    ),
    inject: Options.text('inject').pipe(
      Options.withDescription(
        'Add a header to HTTPS requests to a domain, as DOMAIN:HEADER=VALUE (repeatable, up to 8 domains); the value never enters the microVM'
      ),
      Options.repeated
    ),
    injectFile: Options.text('inject-file').pipe(
      Options.withDescription(
        'Read --inject rules from a file, one DOMAIN:HEADER=VALUE per line (/dev/stdin for a pipe), so the values stay out of the command line'
      ),
      Options.optional
    ),
    clearInject: Options.boolean('clear-inject').pipe(
      Options.withDescription('Remove every header rule added with --inject')
    ),
  },
  ({ microvmId, ...flags }) =>
    requireId('microVM', microvmId).pipe(
      Effect.andThen(updateMicroVmNetwork(microvmId, flags)),
      Effect.asVoid,
      reportErrors('update the microVM network')
    )
).pipe(
  Command.withDescription(
    'Change what a running or paused microVM may reach; connections the new rules no longer allow are closed'
  )
);

// ---------------------------------------------------------------------------
// pause / resume / snapshot / fork
// ---------------------------------------------------------------------------

/** Flags of `microvms pause` and `microvms resume`. */
export interface LifecycleFlags {
  readonly json: boolean;
  readonly waitTimeout: Option.Option<string>;
}

/**
 * Pauses a running microVM and waits until it is paused. The request asks
 * the API not to hold the connection (`wait=false`, answered `202`), so a
 * long capture never runs into a proxy timeout; this command polls instead.
 */
export const pauseMicroVm = (microvmId: string, flags: LifecycleFlags, io: WaitIo = {}) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const answered = yield* apiClient.request((client) => client.microvms.pause(microvmId, { wait: false }));
    const vm = yield* settleMicroVm(answered, flags.waitTimeout, io);
    if (vm.status !== 'paused') {
      return yield* new MicroVmStateError({
        message:
          vm.status === 'running'
            ? `The microVM ${vm.id} could not be paused and keeps running. Try again in a moment.`
            : `The microVM ${vm.id} is ${vm.status}, not paused${vm.stopReason ? ` (${vm.stopReason})` : ''}.`,
        resourceId: vm.id,
        status: vm.status,
      });
    }
    if (flags.json) yield* Console.log(JSON.stringify(vm, null, 2));
    else yield* Console.log(`Paused ${vm.id}. Resume it with "gigadrive microvms resume ${vm.id}".`);
    return vm;
  });

/** Resumes a paused microVM and waits until it runs again. */
export const resumeMicroVm = (microvmId: string, flags: LifecycleFlags, io: WaitIo = {}) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const answered = yield* apiClient.request((client) => client.microvms.resume(microvmId, { wait: false }));
    const vm = yield* settleMicroVm(answered, flags.waitTimeout, io);
    if (vm.status !== 'running') {
      return yield* new MicroVmStateError({
        message:
          vm.status === 'paused'
            ? `The microVM ${vm.id} could not be resumed and is still paused. Try again with "gigadrive microvms resume ${vm.id}".`
            : `The microVM ${vm.id} is ${vm.status}, not running${vm.stopReason ? ` (${vm.stopReason})` : ''}.`,
        resourceId: vm.id,
        status: vm.status,
      });
    }
    if (flags.json) yield* Console.log(JSON.stringify(vm, null, 2));
    else yield* Console.log(`Resumed ${vm.id}.`);
    return vm;
  });

const lifecycleCommand = (name: 'pause' | 'resume') =>
  Command.make(
    name,
    { microvmId: microvmIdArg, json: jsonOption, waitTimeout: waitTimeoutOption },
    ({ microvmId, ...flags }) =>
      requireId('microVM', microvmId).pipe(
        Effect.andThen(name === 'pause' ? pauseMicroVm(microvmId, flags) : resumeMicroVm(microvmId, flags)),
        Effect.asVoid,
        reportErrors(name === 'pause' ? 'pause the microVM' : 'resume the microVM')
      )
  ).pipe(
    Command.withDescription(
      name === 'pause'
        ? 'Pause a microVM with its memory, processes and files; it stops accruing CPU and memory until resumed'
        : 'Resume a paused microVM where it left off'
    )
  );

/** Flags of `microvms snapshot`. */
export interface SnapshotFlags {
  readonly name: Option.Option<string>;
  readonly expires: Option.Option<string>;
  readonly json: boolean;
  readonly waitTimeout: Option.Option<string>;
}

/** Snapshots a running microVM and waits until the snapshot is ready. The microVM keeps running. */
export const snapshotMicroVm = (microvmId: string, flags: SnapshotFlags, io: WaitIo = {}) =>
  Effect.gen(function* () {
    const expiresInMs = yield* optionalDuration('--expires', flags.expires);
    if (expiresInMs !== undefined && expiresInMs < 60_000) {
      return yield* new InvalidMicroVmOptionsError({ message: '--expires must be at least 1m.' });
    }
    const apiClient = yield* ApiClientService;
    const answered = yield* apiClient.request((client) =>
      client.microvms.snapshot(
        microvmId,
        {
          ...Option.match(flags.name, { onNone: () => ({}), onSome: (name) => ({ name }) }),
          ...(expiresInMs !== undefined ? { expiresInMs } : {}),
        },
        { wait: false }
      )
    );
    const snapshot = yield* settleSnapshot(answered, flags.waitTimeout, io);
    if (snapshot.status === 'failed') {
      return yield* new MicroVmStateError({
        message: `The snapshot ${snapshot.id} failed${snapshot.error ? `: ${snapshot.error}` : ''}. The microVM keeps running; try again.`,
        resourceId: snapshot.id,
        status: snapshot.status,
      });
    }
    if (flags.json) {
      yield* Console.log(JSON.stringify(snapshot, null, 2));
    } else {
      yield* Console.log(`Snapshot ${snapshot.id}${snapshot.name ? ` (${snapshot.name})` : ''} is ready.`);
      yield* Console.log(`Create a microVM from it: gigadrive microvms fork ${snapshot.id}`);
    }
    return snapshot;
  });

const snapshotCommand = Command.make(
  'snapshot',
  {
    microvmId: microvmIdArg,
    name: Options.text('name').pipe(Options.withDescription('A label for the snapshot'), Options.optional),
    expires: Options.text('expires').pipe(
      Options.withDescription("Delete the snapshot after this long, such as 24h (default: the plan's retention)"),
      Options.optional
    ),
    json: jsonOption,
    waitTimeout: waitTimeoutOption,
  },
  ({ microvmId, ...flags }) =>
    requireId('microVM', microvmId).pipe(
      Effect.andThen(snapshotMicroVm(microvmId, flags)),
      Effect.asVoid,
      reportErrors('snapshot the microVM')
    )
).pipe(Command.withDescription('Capture a running microVM (memory, processes and files) to create new microVMs from'));

/** Flags of `microvms snapshots ls`. */
export interface ListSnapshotsFlags {
  readonly app: Option.Option<string>;
  readonly limit: number;
  readonly json: boolean;
}

/** Lists the application's snapshots, newest first. */
export const listSnapshots = (flags: ListSnapshotsFlags) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const applicationId = yield* resolveApplicationId(flags.app);
    const snapshots = yield* apiClient.request(async (client) => {
      const items: MicroVmSnapshot[] = [];
      for await (const snapshot of client.microvms.snapshots.listAll({
        applicationId,
        limit: Math.min(flags.limit, 100),
      })) {
        items.push(snapshot);
        if (items.length >= flags.limit) break;
      }
      return items;
    });
    if (flags.json) return yield* Console.log(JSON.stringify(snapshots, null, 2));
    if (snapshots.length === 0) {
      return yield* Console.log('No snapshots yet. Take one with "gigadrive microvms snapshot <microvm-id>".');
    }
    for (const line of formatSnapshotTable(snapshots)) yield* Console.log(line);
  });

const snapshotIdArg = Args.text({ name: 'snapshot-id' }).pipe(Args.withDescription('The snapshot ID'));

const snapshotsListCommand = Command.make(
  'ls',
  {
    app: appOption,
    limit: Options.integer('limit').pipe(
      Options.withDescription('Show at most this many (default: 50)'),
      Options.withDefault(50)
    ),
    json: jsonOption,
  },
  (flags) => listSnapshots(flags).pipe(reportErrors('list snapshots'))
).pipe(Command.withDescription("List the application's microVM snapshots"));

const snapshotsGetCommand = Command.make(
  'get',
  { snapshotId: snapshotIdArg, json: jsonOption },
  ({ snapshotId, json }) =>
    Effect.gen(function* () {
      yield* requireId('snapshot', snapshotId);
      const apiClient = yield* ApiClientService;
      const snapshot = yield* apiClient.request((client) => client.microvms.snapshots.get(snapshotId));
      if (json) return yield* Console.log(JSON.stringify(snapshot, null, 2));
      for (const line of formatSnapshotTable([snapshot])) yield* Console.log(line);
      if (snapshot.error) yield* Console.log(`\nError: ${snapshot.error}`);
    }).pipe(reportErrors('get the snapshot'))
).pipe(Command.withDescription('Show a snapshot'));

const snapshotsRemoveCommand = Command.make(
  'rm',
  {
    snapshotIds: Args.text({ name: 'snapshot-id' }).pipe(
      Args.withDescription('One or more snapshot IDs'),
      Args.atLeast(1)
    ),
  },
  ({ snapshotIds }) =>
    Effect.forEach(
      snapshotIds,
      (snapshotId) =>
        Effect.gen(function* () {
          yield* requireId('snapshot', snapshotId);
          const apiClient = yield* ApiClientService;
          yield* apiClient.request((client) => client.microvms.snapshots.delete(snapshotId));
          yield* Console.log(`Deleted snapshot ${snapshotId}.`);
        }),
      { discard: true }
    ).pipe(reportErrors('delete the snapshot'))
).pipe(Command.withDescription('Delete snapshots; microVMs created from them keep running'));

const snapshotsCommand = Command.make('snapshots', {}, () => Effect.void).pipe(
  Command.withDescription('Snapshots taken with "microvms snapshot", to fork new microVMs from'),
  Command.withSubcommands([snapshotsListCommand, snapshotsGetCommand, snapshotsRemoveCommand])
);

/** Flags of `microvms fork`: the create flags that apply to a microVM made from a snapshot. */
export type ForkFlags = Omit<CreateFlags, 'image' | 'vcpus' | 'memory' | 'volumes' | 'snapshotId'>;

/**
 * Creates a microVM from a snapshot, with its memory, processes and disk. The
 * application defaults to `--app`, the linked one, then the snapshot's own.
 */
export const forkMicroVm = (snapshotId: string, flags: ForkFlags, io: WaitIo = {}) =>
  Effect.gen(function* () {
    const linked = yield* resolveApplicationId(flags.app);
    const app =
      linked !== undefined
        ? Option.some(linked)
        : Option.some(
            (yield* (yield* ApiClientService).request((client) => client.microvms.snapshots.get(snapshotId)))
              .applicationId
          );
    return yield* createMicroVm(
      {
        ...flags,
        app,
        image: Option.none(),
        vcpus: Option.none(),
        memory: Option.none(),
        volumes: [],
        snapshotId,
      },
      io
    );
  });

/** The create options that apply to a fork: a snapshot fixes the image, vCPUs and memory, and forks take no volumes. */
const forkOptions = {
  app: createOptions.app,
  disk: createOptions.disk,
  timeout: createOptions.timeout,
  ports: createOptions.ports,
  env: createOptions.env,
  metadata: createOptions.metadata,
  denyEgress: createOptions.denyEgress,
  privatePreviews: createOptions.privatePreviews,
  allowEgress: createOptions.allowEgress,
  inject: createOptions.inject,
  injectFile: createOptions.injectFile,
  pauseOnTimeout: createOptions.pauseOnTimeout,
  autoResume: createOptions.autoResume,
  region: createOptions.region,
  json: createOptions.json,
  noWait: createOptions.noWait,
  waitTimeout: createOptions.waitTimeout,
};

const forkCommand = Command.make('fork', { snapshotId: snapshotIdArg, ...forkOptions }, ({ snapshotId, ...flags }) =>
  requireId('snapshot', snapshotId).pipe(
    Effect.andThen(forkMicroVm(snapshotId, flags)),
    Effect.asVoid,
    reportErrors('create the microVM from the snapshot')
  )
).pipe(
  Command.withDescription(
    "Create a microVM from a snapshot, with its memory, processes and files; it keeps the snapshot's image and size"
  )
);

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
// volumes
// ---------------------------------------------------------------------------

const volumeIdArg = Args.text({ name: 'volume-id' }).pipe(Args.withDescription('The volume ID'));

const volumesListCommand = Command.make('ls', { app: appOption, json: jsonOption }, ({ app, json }) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const applicationId = yield* resolveApplicationId(app);
    const volumes = yield* apiClient.request((client) => client.microvms.volumes.list({ applicationId }));
    if (json) return yield* Console.log(JSON.stringify(volumes, null, 2));
    if (volumes.length === 0)
      return yield* Console.log('No volumes yet. Create one with "gigadrive microvms volumes create <name>".');
    for (const line of formatVolumeTable(volumes)) yield* Console.log(line);
  }).pipe(reportErrors('list volumes'))
).pipe(Command.withDescription("List the application's volumes"));

/** Flags of `microvms volumes create`. */
export interface CreateVolumeFlags {
  readonly name: string;
  readonly size: Option.Option<number>;
  readonly app: Option.Option<string>;
  readonly json: boolean;
}

/** Creates an empty volume and prints it. */
export const createVolume = (flags: CreateVolumeFlags) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const applicationId = yield* resolveApplicationId(flags.app);
    const volume = yield* apiClient.request((client) =>
      client.microvms.volumes.create({
        name: flags.name,
        ...Option.match(flags.size, { onNone: () => ({}), onSome: (sizeMb) => ({ sizeMb }) }),
        ...(applicationId ? { applicationId } : {}),
      })
    );
    if (flags.json) {
      yield* Console.log(JSON.stringify(volume, null, 2));
    } else {
      yield* Console.log(`Created volume ${volume.name} (${String(volume.sizeMb)} MiB, ${volume.id}).`);
      yield* Console.log(`Attach it: gigadrive microvms create --volume ${volume.name}:/data`);
    }
    return volume;
  });

const volumesCreateCommand = Command.make(
  'create',
  {
    name: Args.text({ name: 'name' }).pipe(
      Args.withDescription('Lowercase letters, digits and -, unique per application')
    ),
    size: Options.integer('size').pipe(
      Options.withDescription('Size in MiB, 1024 to 51200 (default: 10240)'),
      Options.optional
    ),
    app: appOption,
    json: jsonOption,
  },
  (flags) => createVolume(flags).pipe(Effect.asVoid, reportErrors('create the volume'))
).pipe(Command.withDescription('Create an empty volume'));

const volumesRenameCommand = Command.make(
  'rename',
  { volumeId: volumeIdArg, name: Args.text({ name: 'name' }).pipe(Args.withDescription('The new name')) },
  ({ volumeId, name }) =>
    Effect.gen(function* () {
      const apiClient = yield* ApiClientService;
      const volume = yield* apiClient.request((client) => client.microvms.volumes.rename(volumeId, name));
      yield* Console.log(`Renamed the volume to ${volume.name}.`);
    }).pipe(reportErrors('rename the volume'))
).pipe(Command.withDescription('Rename a volume'));

const volumesSaveCommand = Command.make(
  'save',
  { microvmId: Args.text({ name: 'microvm-id' }).pipe(Args.withDescription('A running microVM with volumes')) },
  ({ microvmId }) =>
    Effect.gen(function* () {
      const apiClient = yield* ApiClientService;
      yield* apiClient.request((client) => client.microvms.saveVolumes(microvmId));
      yield* Console.log(`Saved the volumes of ${microvmId}.`);
    }).pipe(reportErrors('save the volumes'))
).pipe(Command.withDescription("Save a running microVM's volumes without stopping it"));

const volumesRemoveCommand = Command.make('rm', { volumeId: volumeIdArg }, ({ volumeId }) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    yield* apiClient.request((client) => client.microvms.volumes.delete(volumeId));
    yield* Console.log(`Deleted volume ${volumeId}.`);
  }).pipe(reportErrors('delete the volume'))
).pipe(Command.withDescription('Delete a volume and its contents (it must not be attached)'));

const volumesCommand = Command.make('volumes', {}, () => Effect.void).pipe(
  Command.withDescription('Persistent filesystems that outlive the microVMs they are attached to'),
  Command.withSubcommands([
    volumesListCommand,
    volumesCreateCommand,
    volumesRenameCommand,
    volumesSaveCommand,
    volumesRemoveCommand,
  ])
);

// ---------------------------------------------------------------------------
// webhooks
// ---------------------------------------------------------------------------

const WEBHOOK_EVENTS: ReadonlyArray<MicroVmWebhookEventType> = [
  'microvm.created',
  'microvm.running',
  'microvm.paused',
  'microvm.stopped',
  'microvm.failed',
];

const webhookIdArg = Args.text({ name: 'webhook-id' }).pipe(Args.withDescription('The webhook ID'));

const webhooksListCommand = Command.make('ls', { app: appOption, json: jsonOption }, ({ app, json }) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const applicationId = yield* resolveApplicationId(app);
    const webhooks = yield* apiClient.request((client) => client.microvms.webhooks.list({ applicationId }));
    if (json) return yield* Console.log(JSON.stringify(webhooks, null, 2));
    if (webhooks.length === 0)
      return yield* Console.log('No webhooks yet. Add one with "gigadrive microvms webhooks add".');
    for (const line of formatWebhookTable(webhooks)) yield* Console.log(line);
  }).pipe(reportErrors('list webhooks'))
).pipe(Command.withDescription("List the application's microVM webhooks"));

/** Flags of `microvms webhooks add`. */
export interface AddWebhookFlags {
  readonly url: string;
  readonly events: ReadonlyArray<string>;
  readonly description: Option.Option<string>;
  readonly app: Option.Option<string>;
  readonly json: boolean;
}

/** Adds a webhook and prints its signing secret once. */
export const addWebhook = (flags: AddWebhookFlags) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const unknown = flags.events.find((event) => !(WEBHOOK_EVENTS as ReadonlyArray<string>).includes(event));
    if (unknown !== undefined) {
      return yield* new InvalidMicroVmOptionsError({
        message: `${unknown} is not a microVM event. Use ${WEBHOOK_EVENTS.join(', ')}.`,
      });
    }
    // SAFETY: every entry was checked against WEBHOOK_EVENTS above.
    const events = (flags.events.length > 0 ? [...new Set(flags.events)] : WEBHOOK_EVENTS) as MicroVmWebhookEventType[];
    const applicationId = yield* resolveApplicationId(flags.app);
    const webhook = yield* apiClient.request((client) =>
      client.microvms.webhooks.create({
        url: flags.url,
        events,
        ...(Option.isSome(flags.description) ? { description: flags.description.value } : {}),
        ...(applicationId ? { applicationId } : {}),
      })
    );
    if (flags.json) {
      yield* Console.log(JSON.stringify(webhook, null, 2));
    } else {
      yield* Console.log(`Added webhook ${webhook.id} for ${webhook.events.join(', ')}.`);
      yield* Console.log(`Signing secret (shown only now): ${webhook.secret}`);
    }
    return webhook;
  });

const webhooksAddCommand = Command.make(
  'add',
  {
    url: Args.text({ name: 'url' }).pipe(Args.withDescription('HTTPS URL on a public host')),
    events: Options.text('event').pipe(
      Options.withDescription(`Event to send (repeatable; default: all of ${WEBHOOK_EVENTS.join(', ')})`),
      Options.repeated
    ),
    description: Options.text('description').pipe(Options.withDescription('A note for yourself'), Options.optional),
    app: appOption,
    json: jsonOption,
  },
  (flags) => addWebhook(flags).pipe(Effect.asVoid, reportErrors('add the webhook'))
).pipe(Command.withDescription('Add an endpoint for microVM lifecycle events and print its signing secret'));

const webhooksEnableCommand = (enabled: boolean) =>
  Command.make(enabled ? 'enable' : 'disable', { webhookId: webhookIdArg }, ({ webhookId }) =>
    Effect.gen(function* () {
      const apiClient = yield* ApiClientService;
      const webhook = yield* apiClient.request((client) => client.microvms.webhooks.update(webhookId, { enabled }));
      yield* Console.log(`${webhook.url} is ${webhook.enabled ? 'enabled' : 'disabled'}.`);
    }).pipe(reportErrors(enabled ? 'enable the webhook' : 'disable the webhook'))
  ).pipe(
    Command.withDescription(
      enabled ? 'Send events to a webhook again' : 'Stop sending events to a webhook; waiting retries are held'
    )
  );

const webhooksSecretCommand = Command.make('rotate-secret', { webhookId: webhookIdArg }, ({ webhookId }) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    const webhook = yield* apiClient.request((client) => client.microvms.webhooks.rotateSecret(webhookId));
    yield* Console.log(`New signing secret (shown only now): ${webhook.secret}`);
  }).pipe(reportErrors('replace the signing secret'))
).pipe(Command.withDescription('Replace the signing secret; the old one stops signing at once'));

const webhooksDeliveriesCommand = Command.make(
  'deliveries',
  { webhookId: webhookIdArg, json: jsonOption },
  ({ webhookId, json }) =>
    Effect.gen(function* () {
      const apiClient = yield* ApiClientService;
      const deliveries = yield* apiClient.request((client) => client.microvms.webhooks.listDeliveries(webhookId));
      if (json) return yield* Console.log(JSON.stringify(deliveries, null, 2));
      if (deliveries.length === 0) return yield* Console.log('Nothing has been sent yet.');
      for (const line of formatDeliveryTable(deliveries)) yield* Console.log(line);
    }).pipe(reportErrors('list the deliveries'))
).pipe(Command.withDescription("Show a webhook's 50 most recent deliveries"));

const webhooksRemoveCommand = Command.make('rm', { webhookId: webhookIdArg }, ({ webhookId }) =>
  Effect.gen(function* () {
    const apiClient = yield* ApiClientService;
    yield* apiClient.request((client) => client.microvms.webhooks.delete(webhookId));
    yield* Console.log(`Deleted webhook ${webhookId}.`);
  }).pipe(reportErrors('delete the webhook'))
).pipe(Command.withDescription('Delete a webhook'));

const webhooksCommand = Command.make('webhooks', {}, () => Effect.void).pipe(
  Command.withDescription('Signed HTTPS requests when a microVM is created, starts, pauses, stops or fails'),
  Command.withSubcommands([
    webhooksListCommand,
    webhooksAddCommand,
    webhooksEnableCommand(true),
    webhooksEnableCommand(false),
    webhooksSecretCommand,
    webhooksDeliveriesCommand,
    webhooksRemoveCommand,
  ])
);

// ---------------------------------------------------------------------------
// microvms (parent)
// ---------------------------------------------------------------------------

const SUBCOMMANDS = [
  createCommand,
  listCommand,
  getCommand,
  metricsCommand,
  execCommand,
  shellCommand,
  copyCommand,
  stopCommand,
  removeCommand,
  extendCommand,
  networkCommand,
  lifecycleCommand('pause'),
  lifecycleCommand('resume'),
  snapshotCommand,
  snapshotsCommand,
  forkCommand,
  imagesCommand,
  volumesCommand,
  webhooksCommand,
] as const;

/** `gigadrive microvms`: create microVMs, run commands and shells in them, copy files, manage images. */
export const microvmsCommand = Command.make('microvms', {}, () => Effect.void).pipe(
  Command.withDescription('Isolated Linux machines for running code: create, exec, shell, cp, pause, snapshot, fork'),
  Command.withSubcommands(SUBCOMMANDS)
);

/** `gigadrive vm`: alias of {@link microvmsCommand}. */
export const vmCommand = Command.make('vm', {}, () => Effect.void).pipe(
  Command.withDescription('Alias of "gigadrive microvms"'),
  Command.withSubcommands(SUBCOMMANDS)
);

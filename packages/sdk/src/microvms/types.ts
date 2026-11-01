/**
 * Wire types of the microVM REST API (`/microvms`, `/microvm-images`).
 *
 * These are the JSON shapes the API returns. The ergonomic {@link MicroVM} and
 * {@link Command} classes wrap them; the low-level `client.microvms` resource
 * returns them as is.
 */

/**
 * Lifecycle of a microVM.
 *
 * `pending` (accepted, not placed yet) → `starting` (booting) → `running`
 * (commands, files and ports are available) → `stopping` → `stopped`.
 * `failed` can follow any state that is not terminal. `stopped` and `failed`
 * are terminal. `pausing`, `paused` and `resuming` are reserved for pause and
 * resume.
 */
export type MicroVmStatus =
  'pending' | 'starting' | 'running' | 'pausing' | 'paused' | 'resuming' | 'stopping' | 'stopped' | 'failed';

/** vCPU counts a microVM can be created with. */
export type MicroVmVcpus = 1 | 2 | 4;

/** Outbound network policy. Private ranges are always blocked, whatever the policy. */
export type MicroVmEgress = 'allow' | 'deny';

/**
 * Who may open a microVM's preview URLs: anyone (`public`, the default) or
 * only requests that carry its preview token (`private`).
 */
export type MicroVmPreviewAccess = 'public' | 'private';

/**
 * What a microVM may reach, as changed by `MicroVM.updateNetwork`: the
 * outbound part of {@link MicroVmNetworkPolicy}. Preview access stays as created.
 */
export type MicroVmEgressPolicy = Omit<MicroVmNetworkPolicy, 'previews'>;

/**
 * What happens when a microVM's timeout ends: `stop` discards it, `pause`
 * pauses it with its memory, processes and files, and a resume runs it for
 * its full timeout again.
 */
export type MicroVmOnTimeout = 'stop' | 'pause';

/** Network policy of a microVM. */
export interface MicroVmNetworkPolicy {
  /** `allow` (default) reaches the internet; `deny` blocks all outbound traffic. */
  egress: MicroVmEgress;
  /** `private` preview URLs answer only requests that carry the preview token. Default `public`. */
  previews?: MicroVmPreviewAccess;
  /**
   * The only destinations the microVM may reach, up to 32: domain names such
   * as `'api.openai.com'` (`'*.github.com'` covers every subdomain, not
   * `github.com` itself) and public IPv4 networks such as `'140.82.112.0/20'`.
   * A name is allowed by the addresses the microVM resolves it to; lookups of
   * other names fail, and an address is blocked unless a listed network
   * contains it or an allowed name resolved to it.
   * Omit to reach the whole internet. Needs `egress: 'allow'`.
   */
  allow?: string[];
}

/** A port exposed by a microVM and its preview URL. */
export interface MicroVmPort {
  /** Port inside the microVM. */
  port: number;
  /** HTTPS URL that forwards to the port, e.g. `https://3000-k3j9x2m1q8zt.vm.gigadrive.app`. */
  url: string;
}

/** A microVM as the API returns it. */
export interface MicroVmInfo {
  /** Stable UUID. */
  id: string;
  /** Unguessable label used in preview hostnames (`<port>-<slug>.vm.<domain>`). */
  slug: string;
  applicationId: string;
  organizationId: string;
  status: MicroVmStatus;
  /** The image the microVM booted from. */
  image: { id: string; name: string };
  vcpus: number;
  memoryMb: number;
  diskMb: number;
  region: string;
  /** Exposed ports with their preview URLs. */
  ports: MicroVmPort[];
  network: MicroVmNetworkPolicy;
  /** Metadata given at create. */
  metadata: Record<string, string>;
  /** Lifetime in milliseconds, as set at create or by the last extension. */
  timeoutMs: number;
  /** What happens when the timeout ends. */
  onTimeout?: MicroVmOnTimeout;
  /** Whether a paused microVM resumes on its own when it is used. */
  autoResume?: boolean;
  /** ISO 8601 time the current timeout ends (see `onTimeout`), or `null` before it started. */
  expiresAt: string | null;
  createdAt: string;
  startedAt: string | null;
  stoppedAt: string | null;
  /** Why the microVM stopped, such as `timeout`, `user`, `host_lost` or `maintenance`. */
  stopReason: string | null;
  /** Volumes attached at create, with their mount paths. */
  volumes?: MicroVmVolumeAttachment[];
}

/** The create answer: a microVM with private previews also carries its preview token, shown only here. */
export interface CreatedMicroVmInfo extends MicroVmInfo {
  previewToken?: string;
}

/** Body of `POST /microvms`. */
export interface CreateMicroVmInput {
  /**
   * Application the microVM belongs to. Optional when the credentials belong to
   * an application or deployment; the SDK also fills it from the client's
   * `applicationId` or `GIGADRIVE_APPLICATION_ID`.
   */
  applicationId?: string;
  /** Built-in image name (`node22`, `python3.13`, ...), custom image name, or image id. Default `node22`. */
  image?: string;
  /** Default 1. */
  vcpus?: MicroVmVcpus;
  /** Memory in MiB, 512 to 8192. Default 2048. */
  memoryMb?: number;
  /** Writable disk in MiB, 1024 to 51200. Default 10240. */
  diskMb?: number;
  /** Lifetime in milliseconds before the microVM stops automatically. Default 300000 (5 minutes), at most 24 hours and the plan's maximum. */
  timeoutMs?: number;
  /** `pause` pauses the microVM when its timeout ends instead of stopping it. Default `stop`. */
  onTimeout?: MicroVmOnTimeout;
  /**
   * Resume the microVM on its own while it is paused: a command or file call
   * resumes it and waits, and a request to a public preview URL resumes it and
   * waits up to 20 seconds. Default `false`.
   */
  autoResume?: boolean;
  /** Up to 8 ports to expose with preview URLs (10000 and 10001 are reserved). */
  ports?: number[];
  /** Environment variables for every command. Never stored by the platform. */
  env?: Record<string, string>;
  /** String metadata to tag the microVM with. */
  metadata?: Record<string, string>;
  /** Region to place the microVM in. Defaults to the platform's choice. */
  region?: string;
  network?: MicroVmNetworkPolicy;
  /**
   * Up to 4 volumes to attach, each at its own mount path. A volume is attached
   * to one live microVM at a time and is saved when the microVM stops. Not
   * combinable with `onTimeout: 'pause'`.
   */
  volumes?: MicroVmVolumeAttachment[];
}

/** A volume attached to a microVM. */
export interface MicroVmVolumeAttachment {
  volumeId: string;
  /** Absolute path the volume is mounted at, such as `/data`. */
  mountPath: string;
}

/**
 * `available`: no microVM holds it. `in_use`: attached to a live microVM.
 * `saving`: its microVM is stopping and the volume is being saved.
 */
export type MicroVmVolumeStatus = 'available' | 'in_use' | 'saving';

/** A persistent filesystem that outlives the microVMs it is attached to. */
export interface MicroVmVolume {
  id: string;
  /** Unique per application. */
  name: string;
  applicationId: string;
  organizationId: string;
  /** Size of the filesystem in MiB. */
  sizeMb: number;
  /** Stored bytes of the last save, or `null` before the first save. */
  storedBytes: number | null;
  status: MicroVmVolumeStatus;
  /** The microVM it is attached to, or `null`. */
  attachedMicrovmId: string | null;
  /** ISO 8601 time of the last successful save. */
  lastSavedAt: string | null;
  /** Why the last save failed; the volume kept its previous contents. */
  lastSaveError: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Body of `POST /microvm-volumes`. */
export interface CreateMicroVmVolumeInput {
  /** Defaults like `CreateMicroVmInput.applicationId`. */
  applicationId?: string;
  /** 1 to 64 characters of lowercase letters, digits and `-`, starting with a letter or digit. */
  name: string;
  /** 1024 to 51200. Default 10240. */
  sizeMb?: number;
}

/** Query of `GET /microvms`. */
export interface ListMicroVmsQuery {
  applicationId?: string;
  status?: MicroVmStatus;
  cursor?: string;
  limit?: number;
}

/** One page of microVMs. */
export interface MicroVmPage {
  items: MicroVmInfo[];
  /** Pass to the next `list` call to continue; absent on the last page. */
  nextCursor?: string;
  /** Whether another page follows. */
  hasMore: boolean;
}

/** Signals that can be sent to a command. */
export type CommandSignal = 'SIGTERM' | 'SIGKILL' | 'SIGINT' | 'SIGHUP' | 'SIGQUIT' | 'SIGUSR1' | 'SIGUSR2';

/** Size of a pseudo-terminal. */
export interface PtySize {
  cols: number;
  rows: number;
}

/** A command as the API returns it. */
export interface CommandInfo {
  /** Command id (`cmd_...`). */
  id: string;
  cmd: string;
  args: string[];
  /** Working directory the command runs in. */
  cwd: string | null;
  /** User the command runs as. */
  user?: string;
  status: 'running' | 'exited';
  /** Exit code, or `null` while running or when a signal killed the process. */
  exitCode: number | null;
  /** Signal that killed the process, such as `SIGKILL`. */
  signal: string | null;
  pid: number | null;
  /** Whether the command runs in a pseudo-terminal. */
  pty: boolean;
  /** Whether the command was killed because it ran past its `timeoutMs`. */
  timedOut: boolean;
  /** ISO 8601 start time. */
  startedAt: string | number;
  finishedAt: string | number | null;
}

/** Body of `POST /microvms/:id/commands`. */
export interface StartCommandInput {
  /**
   * Executable to run. Without `args`, a `cmd` containing whitespace runs
   * through `/bin/sh -c` (shell form, e.g. `npm install && npm test`).
   */
  cmd: string;
  /** Arguments; when present `cmd` is executed directly, without a shell. */
  args?: string[];
  /** Working directory. Defaults to the image's working directory. */
  cwd?: string;
  /** Environment merged over the microVM's environment. */
  env?: Record<string, string>;
  /** User name, `root` or a numeric uid. Defaults to the image's user. */
  user?: string;
  /** Keep stdin open for `POST .../stdin`. Implied by `pty`. */
  stdin?: boolean;
  /** Run in a pseudo-terminal of this size (stdout and stderr are merged). */
  pty?: PtySize;
  /** Kill the command with SIGKILL after this many milliseconds. */
  timeoutMs?: number;
}

/** Result of a command run with `wait: true`. */
export interface CommandRunResult {
  id: string;
  exitCode: number | null;
  /** Signal that killed the process, if any. */
  signal: string | null;
  /** Whether the command was killed because it ran past its `timeoutMs`. */
  timedOut: boolean;
  /** UTF-8 decoded stdout, at most 1 MiB. */
  stdout: string;
  /** UTF-8 decoded stderr, at most 1 MiB. */
  stderr: string;
  /** Whether output was left out (over 1 MiB, or no longer retained). */
  truncated: boolean;
  durationMs: number;
}

/** Query of `GET /microvms/:id/commands/:cmdId/logs`. */
export interface CommandLogsQuery {
  /** Keep the stream open until the command exits. Default `true`. */
  follow?: boolean;
  /** Absolute stdout byte offset to resume from. Default 0. */
  stdoutOffset?: number;
  /** Absolute stderr byte offset to resume from. Default 0. */
  stderrOffset?: number;
}

/** Which output stream a chunk belongs to. */
export type CommandStream = 'stdout' | 'stderr';

/** One event of a command log stream. */
export type CommandLogEvent =
  | {
      type: 'output';
      stream: CommandStream;
      /** The bytes of this chunk. */
      data: Uint8Array;
      /** Absolute byte offset of the first byte of {@link data} in its stream. */
      offset: number;
    }
  | {
      /** Output before the requested offsets is no longer retained (each stream keeps its last 8 MiB). */
      type: 'truncated';
    }
  | {
      /** With `follow: false` on a running command: the buffered output was sent; the command keeps running. */
      type: 'end';
      reason: string;
    }
  | {
      type: 'exit';
      exitCode: number | null;
      signal: string | null;
      /** The command ran past its timeout. Absent from APIs that predate it. */
      timedOut?: boolean;
      /** When the command exited. Absent from APIs that predate it. */
      finishedAt?: string | null;
    };

/** Type of a file system entry. */
export type FileEntryType = 'file' | 'directory' | 'symlink' | 'other';

/** A file or directory inside a microVM. */
export interface FileEntry {
  /** Absolute path. */
  path: string;
  /** Last path segment. */
  name: string;
  type: FileEntryType;
  /** Size in bytes. */
  size: number;
  /** Octal permission bits, e.g. `0644`. */
  mode: string;
  /** ISO 8601 modification time. */
  modifiedAt: string | number;
  /** Link target, for symlinks; otherwise `null`. */
  target?: string | null;
}

/** A directory listing. */
export interface FileListing {
  entries: FileEntry[];
  /** The listing hit its size limit; list a narrower directory. */
  truncated: boolean;
}

/** Result of a file write. */
export interface FileWriteResult {
  path: string;
  /** Bytes written. */
  bytes: number;
}

/** Where a custom image comes from. */
export type MicroVmImageSource = { type: 'registry'; ref: string } | { type: 'dockerfile'; dockerfile: string };

/** Build state of an image. A new image starts `pending`. */
export type MicroVmImageStatus = 'pending' | 'building' | 'ready' | 'failed';

/** A bootable microVM image. Built-in images have no application. */
export interface MicroVmImage {
  id: string;
  /** Name to pass as `image` when creating a microVM. */
  name: string;
  builtin: boolean;
  status: MicroVmImageStatus;
  applicationId: string | null;
  organizationId: string | null;
  source?: MicroVmImageSource | null;
  /** Registry digest the build resolved. */
  sourceDigest?: string | null;
  /** Size of the unpacked root filesystem. */
  sizeBytes?: number | null;
  /** Why the last build failed. */
  error?: string | null;
  buildStartedAt?: string | null;
  buildFinishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Body of `POST /microvm-images`. */
export interface CreateMicroVmImageInput {
  /** Owning application. Filled from the client's default application when omitted. */
  applicationId?: string;
  /** `^[a-z0-9][a-z0-9._-]{0,62}$`, unique per application. */
  name: string;
  /**
   * The image to build: a public `linux/amd64` registry reference such as
   * `python:3.13` or `ghcr.io/acme/tool:1`, or `{ dockerfile }` with the
   * Dockerfile contents. Shorthand for {@link source}.
   */
  from?: string | { dockerfile: string } | { registry: string };
  /** Raw API source. Use this or {@link from}. */
  source?: MicroVmImageSource;
}

/**
 * What changed in a watched directory. `rename` is the old path of a move
 * (its new path gets a `create` when watched); `overflow` means some changes
 * were not reported, so list the directory to catch up.
 */
export type MicroVmFileChangeType = 'create' | 'write' | 'remove' | 'rename' | 'chmod' | 'overflow';

/** One change in a watched directory. */
export interface MicroVmFileChange {
  type: MicroVmFileChangeType;
  /** Absolute path inside the microVM. */
  path: string;
  isDirectory: boolean;
}

/** One CPU point of {@link MicroVmMetrics}. */
export interface MicroVmCpuPoint {
  /** ISO 8601 start of the point. */
  time: string;
  /** CPU the microVM used over the point, as a share of all its vCPUs (0 to 100). */
  cpuPercent: number;
}

/** A microVM's memory and disk use as the microVM itself reports them. */
export interface MicroVmCurrentUsage {
  /** ISO 8601 time of the reading. */
  sampledAt: string;
  uptimeMs: number;
  /** Memory in use (total minus available). */
  memoryUsedBytes: number;
  memoryTotalBytes: number;
  diskUsedBytes: number;
  diskTotalBytes: number;
}

/** A microVM's CPU use over a window and its memory and disk use now. */
export interface MicroVmMetrics {
  microvmId: string;
  vcpus: number;
  memoryMb: number;
  windowMinutes: number;
  /** Length of each CPU point, at least 5 seconds; it grows with the window. */
  stepSeconds: number;
  /** Oldest first. Points where the microVM did not run are omitted. */
  cpu: MicroVmCpuPoint[];
  /** `null` unless the microVM is running and answered within 3 seconds. */
  current: MicroVmCurrentUsage | null;
}

/** A microVM lifecycle event a webhook can subscribe to. */
export type MicroVmWebhookEventType =
  'microvm.created' | 'microvm.running' | 'microvm.paused' | 'microvm.stopped' | 'microvm.failed';

/** An HTTPS endpoint that receives an application's microVM lifecycle events. */
export interface MicroVmWebhook {
  id: string;
  applicationId: string;
  url: string;
  description: string | null;
  events: MicroVmWebhookEventType[];
  /** A disabled webhook receives no new events. */
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A webhook with its signing secret, returned only on create and on secret rotation. */
export interface MicroVmWebhookWithSecret extends MicroVmWebhook {
  /** `whsec_...`: pass it to `verifyMicroVmWebhook`. It is never shown again. */
  secret: string;
}

/** Input of `client.microvms.webhooks.create`. */
export interface CreateMicroVmWebhookInput {
  /** Defaults to the client's `applicationId`; inferred for application and deployment credentials. */
  applicationId?: string;
  /** An `https` URL on a public host. */
  url: string;
  events: MicroVmWebhookEventType[];
  description?: string;
}

/** Input of `client.microvms.webhooks.update`; omitted fields stay as they are. */
export interface UpdateMicroVmWebhookInput {
  url?: string;
  events?: MicroVmWebhookEventType[];
  /** `null` or an empty string removes it. */
  description?: string | null;
  enabled?: boolean;
}

/** One event sent (or still to be sent) to a webhook. */
export interface MicroVmWebhookDelivery {
  id: string;
  /** The `webhook-id` header of the request, the same on every retry. */
  messageId: string;
  eventType: MicroVmWebhookEventType;
  microvmId: string;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  /** HTTP status of the last attempt, `null` when it got no answer. */
  lastStatusCode: number | null;
  lastError: string | null;
  nextAttemptAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

/** The JSON body of a webhook request, as `verifyMicroVmWebhook` returns it. */
export interface MicroVmWebhookEvent {
  type: MicroVmWebhookEventType;
  /** ISO 8601 time the microVM changed state. */
  timestamp: string;
  data: {
    microvmId: string;
    applicationId: string;
    organizationId: string;
    /** The state the microVM reached. */
    status: MicroVmStatus;
    /** The state it left; `null` for `microvm.created`. */
    previousStatus: MicroVmStatus | null;
  };
}

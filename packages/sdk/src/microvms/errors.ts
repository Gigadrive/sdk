import { ApiError, GigadriveError } from '../errors';
import type { CommandInfo } from './types';

/**
 * The microVM is not `running` (it is still starting, or it stopped or
 * failed), so commands, files and preview URLs are unavailable. The API
 * answers `409 microvm_not_running`.
 *
 * @example
 * ```ts
 * try {
 *   await vm.run('ls');
 * } catch (err) {
 *   if (err instanceof MicroVmNotRunningError) await vm.refresh();
 * }
 * ```
 */
export class MicroVmNotRunningError extends ApiError {
  constructor(message = 'The microVM is not running', code = 'microvm_not_running', reason?: string) {
    super(message, 409, code, reason);
    this.name = 'MicroVmNotRunningError';
  }
}

/** The microVM, command or image does not exist, or the credentials cannot see it (`404`). */
export class MicroVmNotFoundError extends ApiError {
  constructor(message = 'Not found', code?: string, reason?: string) {
    super(message, 404, code, reason);
    this.name = 'MicroVmNotFoundError';
  }
}

/** A file or directory does not exist inside the microVM (`404` from a file route). */
export class MicroVmFileNotFoundError extends MicroVmNotFoundError {
  /** The path that was not found. */
  readonly path: string;

  constructor(path: string, message = `No such file or directory: ${path}`, code?: string) {
    super(message, code);
    this.name = 'MicroVmFileNotFoundError';
    this.path = path;
  }
}

/**
 * The microVM is too busy to take the operation right now (`429`/`503`
 * `microvm_busy`). Reads and log streams are retried with backoff before this
 * surfaces; retry later.
 */
export class MicroVmBusyError extends ApiError {
  constructor(message: string, status: number, code = 'microvm_busy', reason?: string) {
    super(message, status, code, reason);
    this.name = 'MicroVmBusyError';
  }
}

/** The platform could not reach the microVM (`502 microvm_unreachable`). Usually transient. */
export class MicroVmUnreachableError extends ApiError {
  constructor(message: string, code = 'microvm_unreachable', reason?: string) {
    super(message, 502, code, reason);
    this.name = 'MicroVmUnreachableError';
  }
}

/** The image is still building or failed to build, so no microVM can boot from it yet (`409 image_not_ready`). */
export class MicroVmImageNotReadyError extends ApiError {
  constructor(message: string, code = 'image_not_ready', reason?: string) {
    super(message, 409, code, reason);
    this.name = 'MicroVmImageNotReadyError';
  }
}

/**
 * A plan limit or quota was reached, such as the number of concurrent
 * microVMs, their size or lifetime (`429 quota_exceeded`, `403 plan_limit_exceeded`).
 */
export class MicroVmQuotaExceededError extends ApiError {
  constructor(message: string, status: number, code?: string, reason?: string) {
    super(message, status, code, reason);
    this.name = 'MicroVmQuotaExceededError';
  }
}

/** The output a command produced, attached to {@link CommandFailedError}. */
export interface CommandOutput {
  commandId: string;
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

/**
 * A command exited with a non-zero code or was killed by a signal, and the
 * caller asked for `throwOnError`.
 *
 * @example
 * ```ts
 * try {
 *   await vm.run('npm', ['test'], { throwOnError: true });
 * } catch (err) {
 *   if (err instanceof CommandFailedError) console.error(err.exitCode, err.stderr);
 * }
 * ```
 */
export class CommandFailedError extends GigadriveError {
  readonly commandId: string;
  /** Exit code, or `null` when a signal killed the process. */
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly stdout: string;
  readonly stderr: string;

  constructor(output: CommandOutput, label = 'Command') {
    const how =
      output.exitCode !== null ? `exited with code ${output.exitCode}` : `was killed by ${output.signal ?? 'a signal'}`;
    const tail = output.stderr.trim().split('\n').slice(-5).join('\n');
    super(tail ? `${label} ${how}:\n${tail}` : `${label} ${how}`);
    this.name = 'CommandFailedError';
    this.commandId = output.commandId;
    this.exitCode = output.exitCode;
    this.signal = output.signal;
    this.stdout = output.stdout;
    this.stderr = output.stderr;
  }

  /** Builds the error from a finished command whose output was not collected. */
  static fromInfo(info: CommandInfo): CommandFailedError {
    return new CommandFailedError({
      commandId: info.id,
      exitCode: info.exitCode,
      signal: info.signal,
      stdout: '',
      stderr: '',
      durationMs: 0,
    });
  }
}

/** A wait (`waitForPort`, `waitUntilRunning`, `images.waitUntilReady`, `command.wait`) ran out of time. */
export class MicroVmTimeoutError extends GigadriveError {
  constructor(message: string) {
    super(message);
    this.name = 'MicroVmTimeoutError';
  }
}

/** The microVM is not exposing the port, so it has no preview URL. Expose ports with `ports` at create. */
export class MicroVmPortNotExposedError extends GigadriveError {
  readonly port: number;

  constructor(port: number, exposed: readonly number[]) {
    super(
      exposed.length === 0
        ? `Port ${port} is not exposed: this microVM exposes no ports. Pass \`ports: [${port}]\` when creating it.`
        : `Port ${port} is not exposed. Exposed ports: ${exposed.join(', ')}.`
    );
    this.name = 'MicroVmPortNotExposedError';
    this.port = port;
  }
}

/**
 * The microVM's previews are private and this object has no valid preview
 * token: pass `previewToken` to `MicroVM.get`, or rotate it with
 * `vm.rotatePreviewToken()`.
 */
export class MicroVmPreviewTokenRequiredError extends GigadriveError {
  readonly microvmId: string;

  constructor(microvmId: string) {
    super(
      `The microVM ${microvmId} has private previews and no valid preview token is known. Pass \`previewToken\` to MicroVM.get, or call vm.rotatePreviewToken().`
    );
    this.name = 'MicroVmPreviewTokenRequiredError';
    this.microvmId = microvmId;
  }
}

/** The microVM failed while starting, or stopped before it was ready. */
export class MicroVmStartError extends GigadriveError {
  readonly microvmId: string;
  readonly status: string;
  readonly stopReason: string | null;

  constructor(microvmId: string, status: string, stopReason: string | null) {
    super(`The microVM ${microvmId} is ${status}${stopReason ? ` (${stopReason})` : ''}`);
    this.name = 'MicroVmStartError';
    this.microvmId = microvmId;
    this.status = status;
    this.stopReason = stopReason;
  }
}

/**
 * {@link MicroVM.create} gave up on a microVM and could not delete it either.
 * The microVM may still boot and bill: delete it by {@link microvmId}.
 */
export class MicroVmCleanupError extends GigadriveError {
  readonly microvmId: string;
  /** Why deleting the microVM failed. {@link Error.cause} is why creating it failed. */
  readonly cleanupError: unknown;

  constructor(microvmId: string, cause: unknown, cleanupError: unknown) {
    super(
      `Creating the microVM ${microvmId} failed and deleting it failed too. Delete it with MicroVM.get('${microvmId}') and delete().`
    );
    this.name = 'MicroVmCleanupError';
    this.microvmId = microvmId;
    this.cleanupError = cleanupError;
    this.cause = cause;
  }
}

/** A custom image build failed. */
export class MicroVmImageBuildError extends GigadriveError {
  readonly imageId: string;

  constructor(imageId: string, message: string | null | undefined) {
    super(`The image build failed${message ? `: ${message}` : ''}`);
    this.name = 'MicroVmImageBuildError';
    this.imageId = imageId;
  }
}

const NOT_RUNNING = /microvm[_ ]not[_ ]running|not running/i;

/**
 * Re-types an {@link ApiError} from a microVM route as the specific microVM
 * error. Anything else is returned unchanged.
 *
 * @param error - The rejection to classify.
 * @param filePath - Set for file routes, so a `404` becomes {@link MicroVmFileNotFoundError}.
 * @internal
 */
export const toMicroVmError = (error: unknown, filePath?: string): unknown => {
  // Only plain `ApiError`s are classified; already typed errors pass through.
  if (!(error instanceof ApiError) || Object.getPrototypeOf(error) !== ApiError.prototype) return error;
  const { message, status, code, reason } = error;
  if (code === 'microvm_busy') return new MicroVmBusyError(message, status, code, reason);
  if (code === 'microvm_unreachable') return new MicroVmUnreachableError(message, code, reason);
  if (code === 'image_not_ready') return new MicroVmImageNotReadyError(message, code, reason);
  if (code === 'quota_exceeded' || code === 'plan_limit_exceeded') {
    return new MicroVmQuotaExceededError(message, status, code, reason);
  }
  if (status === 409 && (code === 'microvm_not_running' || (code === undefined && NOT_RUNNING.test(message)))) {
    return new MicroVmNotRunningError(message, code ?? 'microvm_not_running', reason);
  }
  if (status === 404) {
    // File routes answer `guest_not_found` for a missing path and `not_found` for a missing microVM.
    const vmMissing = code === 'not_found' || code === 'microvm_not_found';
    return filePath !== undefined && !vmMissing
      ? new MicroVmFileNotFoundError(filePath, message, code)
      : new MicroVmNotFoundError(message, code, reason);
  }
  return error;
};

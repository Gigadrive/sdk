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

/** A plan limit was reached, such as the number of concurrent microVMs or their total memory (`402`/`429` quota). */
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
  if (
    !(error instanceof ApiError) ||
    error instanceof MicroVmNotRunningError ||
    error instanceof MicroVmNotFoundError
  ) {
    return error;
  }
  if (error.status === 409 && (error.code === 'microvm_not_running' || NOT_RUNNING.test(error.message))) {
    return new MicroVmNotRunningError(error.message, error.code ?? 'microvm_not_running', error.reason);
  }
  if (error.status === 404) {
    const vmMissing = error.code === 'microvm_not_found' || /microvm/i.test(error.code ?? '');
    return filePath !== undefined && !vmMissing
      ? new MicroVmFileNotFoundError(filePath, error.message, error.code)
      : new MicroVmNotFoundError(error.message, error.code, error.reason);
  }
  if (error.code === 'quota_exceeded' || error.code === 'microvm_quota_exceeded') {
    return new MicroVmQuotaExceededError(error.message, error.status, error.code, error.reason);
  }
  return error;
};

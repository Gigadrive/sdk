import { describe, expect, it } from 'vitest';
import { ApiError, GigadriveError } from '../errors';
import {
  CommandFailedError,
  MicroVmFileNotFoundError,
  MicroVmImageBuildError,
  MicroVmNotFoundError,
  MicroVmNotRunningError,
  MicroVmPortNotExposedError,
  MicroVmQuotaExceededError,
  MicroVmStartError,
  toMicroVmError,
} from './errors';

describe('toMicroVmError', () => {
  it('leaves non-API errors and already typed errors alone', () => {
    const plain = new Error('x');
    const typed = new MicroVmNotRunningError();
    expect(toMicroVmError(plain)).toBe(plain);
    expect(toMicroVmError('string')).toBe('string');
    expect(toMicroVmError(typed)).toBe(typed);
  });

  it('classifies by status and code', () => {
    expect(toMicroVmError(new ApiError('x', 409, 'microvm_not_running'))).toBeInstanceOf(MicroVmNotRunningError);
    expect(toMicroVmError(new ApiError('The microVM is not running', 409))).toBeInstanceOf(MicroVmNotRunningError);
    expect(toMicroVmError(new ApiError('exists', 409, 'already_exists'))).not.toBeInstanceOf(MicroVmNotRunningError);
    expect(toMicroVmError(new ApiError('gone', 404))).toBeInstanceOf(MicroVmNotFoundError);
    expect(toMicroVmError(new ApiError('gone', 404), '/a')).toBeInstanceOf(MicroVmFileNotFoundError);
    expect(toMicroVmError(new ApiError('limit', 429, 'quota_exceeded'))).toBeInstanceOf(MicroVmQuotaExceededError);
    const other = new ApiError('bad', 400, 'invalid_argument');
    expect(toMicroVmError(other)).toBe(other);
  });

  it('keeps every typed error an ApiError or GigadriveError', () => {
    expect(new MicroVmNotRunningError()).toBeInstanceOf(ApiError);
    expect(new MicroVmFileNotFoundError('/a')).toBeInstanceOf(MicroVmNotFoundError);
    expect(new MicroVmFileNotFoundError('/a').message).toBe('No such file or directory: /a');
    expect(new MicroVmPortNotExposedError(80, [])).toBeInstanceOf(GigadriveError);
    expect(new MicroVmPortNotExposedError(80, []).message).toContain('exposes no ports');
    expect(new MicroVmStartError('vm', 'failed', 'boot_failed').message).toBe('The microVM vm is failed (boot_failed)');
    expect(new MicroVmImageBuildError('img', null).message).toBe('The image build failed');
  });
});

describe('CommandFailedError', () => {
  it('describes exit codes and signals with the stderr tail', () => {
    const base = { commandId: 'c', stdout: '', durationMs: 1 };
    const exited = new CommandFailedError({ ...base, exitCode: 1, signal: null, stderr: '1\n2\n3\n4\n5\n6\n' });
    expect(exited.message).toBe('Command exited with code 1:\n2\n3\n4\n5\n6');
    expect(exited.name).toBe('CommandFailedError');

    const killed = new CommandFailedError({ ...base, exitCode: null, signal: 'SIGKILL', stderr: '' });
    expect(killed.message).toBe('Command was killed by SIGKILL');
  });

  it('builds from a command without output', () => {
    const error = CommandFailedError.fromInfo({
      id: 'cmd_1',
      cmd: 'false',
      args: [],
      cwd: null,
      status: 'exited',
      exitCode: 1,
      signal: null,
      pid: 1,
      pty: false,
      startedAt: 0,
      finishedAt: 1,
    });
    expect(error).toMatchObject({ commandId: 'cmd_1', exitCode: 1, stdout: '', stderr: '' });
  });
});

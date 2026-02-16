import { describe, expect, it } from 'vitest';
import {
  ArchiveCreateError,
  AuthStorageReadError,
  AuthStorageWriteError,
  BuildScriptNotFoundError,
  ConfigNotFoundError,
  ConfigParseError,
  ConfigValidationError,
  DeploymentCreateError,
  DeploymentFailedError,
  DeploymentLogsFetchError,
  DeploymentStatusError,
  ExecError,
  LoginFlowError,
  NotAuthenticatedError,
  OAuthDiscoveryError,
  PackageJsonNotFoundError,
  PackageManagerNotFoundError,
  PresignedUrlError,
  TokenExchangeError,
  TokenRefreshError,
  UploadCompleteError,
  UploadPartError,
  UploadStartError,
  UserInfoFetchError,
} from './errors';

// ---------------------------------------------------------------------------
// Auth errors
// ---------------------------------------------------------------------------

describe('Auth errors', () => {
  it('OAuthDiscoveryError should have correct _tag and fields', () => {
    const error = new OAuthDiscoveryError({ message: 'Discovery failed', cause: 'timeout' });
    expect(error._tag).toBe('OAuthDiscoveryError');
    expect(error.message).toBe('Discovery failed');
    expect(error.cause).toBe('timeout');
  });

  it('OAuthDiscoveryError should work without optional fields', () => {
    const error = new OAuthDiscoveryError({ message: 'Discovery failed' });
    expect(error._tag).toBe('OAuthDiscoveryError');
    expect(error.cause).toBeUndefined();
  });

  it('AuthStorageReadError should have correct _tag', () => {
    const error = new AuthStorageReadError({ message: 'Read failed' });
    expect(error._tag).toBe('AuthStorageReadError');
    expect(error.message).toBe('Read failed');
  });

  it('AuthStorageWriteError should have correct _tag and fields', () => {
    const error = new AuthStorageWriteError({ message: 'Write failed', cause: 'EACCES' });
    expect(error._tag).toBe('AuthStorageWriteError');
    expect(error.message).toBe('Write failed');
    expect(error.cause).toBe('EACCES');
  });

  it('LoginFlowError should have correct _tag and fields', () => {
    const error = new LoginFlowError({ message: 'Login failed', cause: 'server error' });
    expect(error._tag).toBe('LoginFlowError');
    expect(error.message).toBe('Login failed');
    expect(error.cause).toBe('server error');
  });

  it('TokenExchangeError should have correct _tag and fields', () => {
    const error = new TokenExchangeError({ message: 'Exchange failed', statusCode: 400 });
    expect(error._tag).toBe('TokenExchangeError');
    expect(error.message).toBe('Exchange failed');
    expect(error.statusCode).toBe(400);
  });

  it('TokenRefreshError should have correct _tag and fields', () => {
    const error = new TokenRefreshError({ message: 'Refresh failed', statusCode: 401 });
    expect(error._tag).toBe('TokenRefreshError');
    expect(error.message).toBe('Refresh failed');
    expect(error.statusCode).toBe(401);
  });

  it('NotAuthenticatedError should have correct _tag', () => {
    const error = new NotAuthenticatedError({ message: 'Not logged in' });
    expect(error._tag).toBe('NotAuthenticatedError');
    expect(error.message).toBe('Not logged in');
  });

  it('UserInfoFetchError should have correct _tag and fields', () => {
    const error = new UserInfoFetchError({ message: 'Fetch failed', statusCode: 500 });
    expect(error._tag).toBe('UserInfoFetchError');
    expect(error.statusCode).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Project errors
// ---------------------------------------------------------------------------

describe('Project errors', () => {
  it('ConfigNotFoundError should have correct _tag and fields', () => {
    const error = new ConfigNotFoundError({ message: 'Not found', directory: '/app' });
    expect(error._tag).toBe('ConfigNotFoundError');
    expect(error.message).toBe('Not found');
    expect(error.directory).toBe('/app');
  });

  it('ConfigParseError should have correct _tag and fields', () => {
    const error = new ConfigParseError({ message: 'Parse failed', cause: 'invalid yaml' });
    expect(error._tag).toBe('ConfigParseError');
    expect(error.cause).toBe('invalid yaml');
  });

  it('ConfigValidationError should have correct _tag and fields', () => {
    const error = new ConfigValidationError({ message: 'Invalid', errors: ['missing name', 'bad region'] });
    expect(error._tag).toBe('ConfigValidationError');
    expect(error.errors).toEqual(['missing name', 'bad region']);
  });

  it('PackageJsonNotFoundError should have correct _tag and fields', () => {
    const error = new PackageJsonNotFoundError({ message: 'No package.json', directory: '/project' });
    expect(error._tag).toBe('PackageJsonNotFoundError');
    expect(error.directory).toBe('/project');
  });

  it('BuildScriptNotFoundError should have correct _tag', () => {
    const error = new BuildScriptNotFoundError({ message: 'No build script' });
    expect(error._tag).toBe('BuildScriptNotFoundError');
  });

  it('PackageManagerNotFoundError should have correct _tag and fields', () => {
    const error = new PackageManagerNotFoundError({ message: 'No PM found', directory: '/project' });
    expect(error._tag).toBe('PackageManagerNotFoundError');
    expect(error.directory).toBe('/project');
  });
});

// ---------------------------------------------------------------------------
// Build errors
// ---------------------------------------------------------------------------

describe('Build errors', () => {
  it('ExecError should have correct _tag and fields', () => {
    const error = new ExecError({ message: 'Command failed', command: 'npm build', cause: 'exit code 1' });
    expect(error._tag).toBe('ExecError');
    expect(error.command).toBe('npm build');
    expect(error.cause).toBe('exit code 1');
  });
});

// ---------------------------------------------------------------------------
// Deployment errors
// ---------------------------------------------------------------------------

describe('Deployment errors', () => {
  it('DeploymentCreateError should have correct _tag and fields', () => {
    const error = new DeploymentCreateError({ message: 'Create failed', statusCode: 500 });
    expect(error._tag).toBe('DeploymentCreateError');
    expect(error.statusCode).toBe(500);
  });

  it('UploadStartError should have correct _tag and fields', () => {
    const error = new UploadStartError({ message: 'Start failed', statusCode: 503 });
    expect(error._tag).toBe('UploadStartError');
    expect(error.statusCode).toBe(503);
  });

  it('PresignedUrlError should have correct _tag and fields', () => {
    const error = new PresignedUrlError({ message: 'URL failed', partNumber: 3 });
    expect(error._tag).toBe('PresignedUrlError');
    expect(error.partNumber).toBe(3);
  });

  it('UploadPartError should have correct _tag and fields', () => {
    const error = new UploadPartError({ message: 'Upload failed', partNumber: 2 });
    expect(error._tag).toBe('UploadPartError');
    expect(error.partNumber).toBe(2);
  });

  it('UploadCompleteError should have correct _tag', () => {
    const error = new UploadCompleteError({ message: 'Complete failed' });
    expect(error._tag).toBe('UploadCompleteError');
  });

  it('DeploymentStatusError should have correct _tag', () => {
    const error = new DeploymentStatusError({ message: 'Status failed' });
    expect(error._tag).toBe('DeploymentStatusError');
  });

  it('DeploymentLogsFetchError should have correct _tag', () => {
    const error = new DeploymentLogsFetchError({ message: 'Logs failed' });
    expect(error._tag).toBe('DeploymentLogsFetchError');
  });

  it('ArchiveCreateError should have correct _tag and fields', () => {
    const error = new ArchiveCreateError({ message: 'Archive failed', cause: 'ENOSPC' });
    expect(error._tag).toBe('ArchiveCreateError');
    expect(error.cause).toBe('ENOSPC');
  });

  it('DeploymentFailedError should have correct _tag', () => {
    const error = new DeploymentFailedError({ message: 'Deployment failed' });
    expect(error._tag).toBe('DeploymentFailedError');
  });
});

// ---------------------------------------------------------------------------
// Errors are proper Error instances
// ---------------------------------------------------------------------------

describe('Error inheritance', () => {
  it('all errors should be instances of Error', () => {
    const errors = [
      new OAuthDiscoveryError({ message: 'test' }),
      new AuthStorageReadError({ message: 'test' }),
      new AuthStorageWriteError({ message: 'test' }),
      new LoginFlowError({ message: 'test' }),
      new TokenExchangeError({ message: 'test' }),
      new TokenRefreshError({ message: 'test' }),
      new NotAuthenticatedError({ message: 'test' }),
      new UserInfoFetchError({ message: 'test' }),
      new ConfigNotFoundError({ message: 'test', directory: '/test' }),
      new ConfigParseError({ message: 'test' }),
      new ConfigValidationError({ message: 'test', errors: [] }),
      new PackageJsonNotFoundError({ message: 'test', directory: '/test' }),
      new BuildScriptNotFoundError({ message: 'test' }),
      new PackageManagerNotFoundError({ message: 'test', directory: '/test' }),
      new ExecError({ message: 'test', command: 'test' }),
      new DeploymentCreateError({ message: 'test' }),
      new UploadStartError({ message: 'test' }),
      new PresignedUrlError({ message: 'test', partNumber: 1 }),
      new UploadPartError({ message: 'test', partNumber: 1 }),
      new UploadCompleteError({ message: 'test' }),
      new DeploymentStatusError({ message: 'test' }),
      new DeploymentLogsFetchError({ message: 'test' }),
      new ArchiveCreateError({ message: 'test' }),
      new DeploymentFailedError({ message: 'test' }),
    ];

    for (const error of errors) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it('each error should have a unique _tag', () => {
    const tags = [
      'OAuthDiscoveryError',
      'AuthStorageReadError',
      'AuthStorageWriteError',
      'LoginFlowError',
      'TokenExchangeError',
      'TokenRefreshError',
      'NotAuthenticatedError',
      'UserInfoFetchError',
      'ConfigNotFoundError',
      'ConfigParseError',
      'ConfigValidationError',
      'PackageJsonNotFoundError',
      'BuildScriptNotFoundError',
      'PackageManagerNotFoundError',
      'ExecError',
      'DeploymentCreateError',
      'UploadStartError',
      'PresignedUrlError',
      'UploadPartError',
      'UploadCompleteError',
      'DeploymentStatusError',
      'DeploymentLogsFetchError',
      'ArchiveCreateError',
      'DeploymentFailedError',
    ];

    const uniqueTags = new Set(tags);
    expect(uniqueTags.size).toBe(tags.length);
  });
});

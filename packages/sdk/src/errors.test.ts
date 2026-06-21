import { describe, expect, it } from 'vitest';
import { ApiError, AuthenticationError, GigadriveError, UploadError, UploadSessionExpiredError } from './errors';

describe('errors', () => {
  it('GigadriveError is the base SDK error', () => {
    const error = new GigadriveError('boom');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('GigadriveError');
    expect(error.message).toBe('boom');
  });

  it('AuthenticationError extends GigadriveError', () => {
    const error = new AuthenticationError('nope');
    expect(error).toBeInstanceOf(GigadriveError);
    expect(error.name).toBe('AuthenticationError');
  });

  it('ApiError carries status and an optional code', () => {
    const error = new ApiError('bad', 404, 'not_found');
    expect(error).toBeInstanceOf(GigadriveError);
    expect(error.name).toBe('ApiError');
    expect(error.status).toBe(404);
    expect(error.code).toBe('not_found');
    expect(new ApiError('x', 500).code).toBeUndefined();
  });

  it('UploadError preserves the underlying cause', () => {
    const cause = new Error('root');
    const error = new UploadError('failed', cause);
    expect(error).toBeInstanceOf(GigadriveError);
    expect(error.name).toBe('UploadError');
    expect(error.cause).toBe(cause);
  });

  it('UploadSessionExpiredError extends UploadError with a default message', () => {
    const error = new UploadSessionExpiredError();
    expect(error).toBeInstanceOf(UploadError);
    expect(error.name).toBe('UploadSessionExpiredError');
    expect(error.message).toMatch(/expired/i);
  });
});

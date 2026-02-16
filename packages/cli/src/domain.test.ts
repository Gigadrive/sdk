import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  ApplicationId,
  DeploymentId,
  DeploymentLog,
  DeploymentLogPage,
  DeploymentLogType,
  DeploymentStatus,
  OAuthClientConfig,
  OAuthTokens,
  PackageManager,
  StoredAuthData,
  UploadId,
} from './domain';

// ---------------------------------------------------------------------------
// Branded IDs
// ---------------------------------------------------------------------------

describe('DeploymentId', () => {
  it('should decode a valid string', () => {
    const result = Schema.decodeUnknownSync(DeploymentId)('dep-123');
    expect(result).toBe('dep-123');
  });

  it('should reject a non-string value', () => {
    expect(() => Schema.decodeUnknownSync(DeploymentId)(123)).toThrow();
  });
});

describe('ApplicationId', () => {
  it('should decode a valid string', () => {
    const result = Schema.decodeUnknownSync(ApplicationId)('app-456');
    expect(result).toBe('app-456');
  });

  it('should reject a non-string value', () => {
    expect(() => Schema.decodeUnknownSync(ApplicationId)(null)).toThrow();
  });
});

describe('UploadId', () => {
  it('should decode a valid string', () => {
    const result = Schema.decodeUnknownSync(UploadId)('upload-789');
    expect(result).toBe('upload-789');
  });

  it('should reject a non-string value', () => {
    expect(() => Schema.decodeUnknownSync(UploadId)(undefined)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Literal schemas
// ---------------------------------------------------------------------------

describe('DeploymentStatus', () => {
  const validStatuses = ['PENDING', 'BUILDING', 'PROVISIONING', 'FAILED', 'ACTIVE', 'SUSPENDED'] as const;

  it.each(validStatuses)('should accept "%s"', (status) => {
    expect(Schema.decodeUnknownSync(DeploymentStatus)(status)).toBe(status);
  });

  it('should reject an invalid status', () => {
    expect(() => Schema.decodeUnknownSync(DeploymentStatus)('UNKNOWN')).toThrow();
  });
});

describe('DeploymentLogType', () => {
  const validTypes = ['INFO', 'ERROR', 'WARN'] as const;

  it.each(validTypes)('should accept "%s"', (type) => {
    expect(Schema.decodeUnknownSync(DeploymentLogType)(type)).toBe(type);
  });

  it('should reject an invalid type', () => {
    expect(() => Schema.decodeUnknownSync(DeploymentLogType)('DEBUG')).toThrow();
  });
});

describe('PackageManager', () => {
  const validManagers = ['npm', 'yarn', 'pnpm', 'bun'] as const;

  it.each(validManagers)('should accept "%s"', (pm) => {
    expect(Schema.decodeUnknownSync(PackageManager)(pm)).toBe(pm);
  });

  it('should reject an invalid package manager', () => {
    expect(() => Schema.decodeUnknownSync(PackageManager)('deno')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Struct schemas
// ---------------------------------------------------------------------------

describe('DeploymentLog', () => {
  it('should decode a valid log entry', () => {
    const input = { id: 'log-1', message: 'Build started', type: 'INFO', createdAt: '2025-01-01T00:00:00Z' };
    const result = Schema.decodeUnknownSync(DeploymentLog)(input);
    expect(result).toEqual(input);
  });

  it('should reject a log entry with missing fields', () => {
    expect(() => Schema.decodeUnknownSync(DeploymentLog)({ id: 'log-1' })).toThrow();
  });

  it('should reject a log entry with an invalid type', () => {
    const input = { id: 'log-1', message: 'msg', type: 'DEBUG', createdAt: '2025-01-01T00:00:00Z' };
    expect(() => Schema.decodeUnknownSync(DeploymentLog)(input)).toThrow();
  });
});

describe('DeploymentLogPage', () => {
  it('should decode a valid log page', () => {
    const input = {
      totalItems: 100,
      limit: 10,
      offset: 0,
      items: [{ id: 'log-1', message: 'msg', type: 'INFO', createdAt: '2025-01-01T00:00:00Z' }],
    };
    const result = Schema.decodeUnknownSync(DeploymentLogPage)(input);
    expect(result).toEqual(input);
  });

  it('should decode a page with empty items', () => {
    const input = { totalItems: 0, limit: 10, offset: 0, items: [] };
    const result = Schema.decodeUnknownSync(DeploymentLogPage)(input);
    expect(result.items).toEqual([]);
  });

  it('should reject a page with missing totalItems', () => {
    expect(() => Schema.decodeUnknownSync(DeploymentLogPage)({ limit: 10, offset: 0, items: [] })).toThrow();
  });
});

describe('OAuthTokens', () => {
  it('should decode tokens with all fields', () => {
    const input = { access_token: 'abc', refresh_token: 'def', expires_in: 3600, token_type: 'Bearer' };
    const result = Schema.decodeUnknownSync(OAuthTokens)(input);
    expect(result).toEqual(input);
  });

  it('should decode tokens with only required fields', () => {
    const input = { access_token: 'abc' };
    const result = Schema.decodeUnknownSync(OAuthTokens)(input);
    expect(result.access_token).toBe('abc');
    expect(result.refresh_token).toBeUndefined();
    expect(result.expires_in).toBeUndefined();
    expect(result.token_type).toBeUndefined();
  });

  it('should reject tokens missing access_token', () => {
    expect(() => Schema.decodeUnknownSync(OAuthTokens)({ refresh_token: 'abc' })).toThrow();
  });
});

describe('OAuthClientConfig', () => {
  const validConfig = {
    clientId: 'client-1',
    issuer: 'https://idp.example.com',
    authorizeUrl: 'https://idp.example.com/authorize',
    tokenUrl: 'https://idp.example.com/token',
    scope: 'openid profile email',
    userinfoUrl: 'https://idp.example.com/userinfo',
  };

  it('should decode a valid config', () => {
    const result = Schema.decodeUnknownSync(OAuthClientConfig)(validConfig);
    expect(result).toEqual(validConfig);
  });

  it('should reject a config with missing fields', () => {
    const { clientId, ...incomplete } = validConfig;
    expect(() => Schema.decodeUnknownSync(OAuthClientConfig)(incomplete)).toThrow();
  });
});

describe('StoredAuthData', () => {
  it('should decode data with all fields', () => {
    const input = { refreshToken: 'rt', accessToken: 'at', tokenExpirationTime: 1700000000000 };
    const result = Schema.decodeUnknownSync(StoredAuthData)(input);
    expect(result).toEqual(input);
  });

  it('should decode data with only required fields', () => {
    const input = { refreshToken: 'rt' };
    const result = Schema.decodeUnknownSync(StoredAuthData)(input);
    expect(result.refreshToken).toBe('rt');
    expect(result.accessToken).toBeUndefined();
    expect(result.tokenExpirationTime).toBeUndefined();
  });

  it('should reject data missing refreshToken', () => {
    expect(() => Schema.decodeUnknownSync(StoredAuthData)({ accessToken: 'at' })).toThrow();
  });

  it('should encode and decode roundtrip', () => {
    const input = { refreshToken: 'rt', accessToken: 'at', tokenExpirationTime: 1700000000000 };
    const encoded = Schema.encodeSync(StoredAuthData)(input as StoredAuthData);
    const decoded = Schema.decodeUnknownSync(StoredAuthData)(encoded);
    expect(decoded).toEqual(input);
  });
});

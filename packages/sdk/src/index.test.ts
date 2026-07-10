import { describe, expect, it } from 'vitest';
import * as sdk from './index';

describe('public exports', () => {
  it('exports the client and error classes', () => {
    expect(typeof sdk.GigadriveClient).toBe('function');
    expect(typeof sdk.GigadriveError).toBe('function');
    expect(typeof sdk.ApiError).toBe('function');
    expect(typeof sdk.AuthenticationError).toBe('function');
    expect(typeof sdk.UploadError).toBe('function');
    expect(typeof sdk.UploadSessionExpiredError).toBe('function');
  });

  it('exports the helper functions', () => {
    expect(typeof sdk.paginate).toBe('function');
    expect(typeof sdk.parseSSEStream).toBe('function');
  });

  it('exports every resource class', () => {
    const classes = [
      'OrganizationsResource',
      'OrganizationEnvVarsResource',
      'OrganizationAiGatewayResource',
      'OrganizationMembersResource',
      'OrganizationProductsResource',
      'ApplicationsResource',
      'ApplicationEnvVarsResource',
      'ApplicationRequestsResource',
      'ApplicationStorageResource',
      'DeploymentsResource',
      'AiGatewayResource',
      'StorageBucketsResource',
      'StorageObjectsResource',
      'StorageUploadSessionsResource',
    ] as const;
    for (const name of classes) {
      expect(typeof (sdk as Record<string, unknown>)[name]).toBe('function');
    }
  });
});

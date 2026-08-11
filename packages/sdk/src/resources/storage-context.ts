import { ConfigurationError } from '../errors';

/**
 * Canonical environment-scoped bucket name or a deprecated bucket UUID.
 *
 * REST callers should use the immutable bucket `name`. UUID values remain
 * accepted while existing integrations migrate. Global delivery/S3 slugs are
 * not valid REST bucket references.
 */
export type StorageBucketReference = string;

/** Selects an application environment by slug or UUID for management calls. */
export interface StorageEnvironmentOptions {
  /**
   * Environment slug or UUID. Deployed workloads normally omit this because
   * their credential determines the authoritative environment.
   */
  environment?: string;
}

/** @internal */
export const resolveStorageApplicationId = (
  defaultApplicationId: string | undefined,
  explicitApplicationId?: string
): string => {
  const applicationId = explicitApplicationId ?? defaultApplicationId;
  if (applicationId) return applicationId;

  throw new ConfigurationError(
    'No application context is configured. Pass an application ID to this call, set GigadriveClientConfig.applicationId, or run inside a Gigadrive deployment with GIGADRIVE_APPLICATION_ID.'
  );
};

/** @internal */
export const resolveStorageBucketReference = (input: {
  bucket?: string;
  bucketId?: string;
}): StorageBucketReference => {
  const hasBucket = typeof input.bucket === 'string';
  const hasBucketId = typeof input.bucketId === 'string';

  if (hasBucket === hasBucketId) {
    throw new ConfigurationError(
      'Provide exactly one storage bucket reference using `bucket` or deprecated `bucketId`.'
    );
  }

  return hasBucket ? (input.bucket as string) : (input.bucketId as string);
};

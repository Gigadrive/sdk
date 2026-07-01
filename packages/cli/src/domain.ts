import { Schema } from 'effect';

// ---------------------------------------------------------------------------
// Re-export shared types from SDK
// ---------------------------------------------------------------------------

export type { DeploymentLog, DeploymentLogPage, DeploymentLogType, DeploymentStatus } from '@gigadrive/sdk';

// ---------------------------------------------------------------------------
// Branded IDs (CLI-specific, for type safety within Effect pipelines)
// ---------------------------------------------------------------------------

export const DeploymentId = Schema.String.pipe(Schema.brand('@Gigadrive/DeploymentId'));
export type DeploymentId = Schema.Schema.Type<typeof DeploymentId>;

export const ApplicationId = Schema.String.pipe(Schema.brand('@Gigadrive/ApplicationId'));
export type ApplicationId = Schema.Schema.Type<typeof ApplicationId>;

export const UploadId = Schema.String.pipe(Schema.brand('@Gigadrive/UploadId'));
export type UploadId = Schema.Schema.Type<typeof UploadId>;

// ---------------------------------------------------------------------------
// CLI-specific domain schemas
// ---------------------------------------------------------------------------

export const PackageManager = Schema.Literal('npm', 'yarn', 'pnpm', 'bun');
export type PackageManager = Schema.Schema.Type<typeof PackageManager>;

// ---------------------------------------------------------------------------
// OAuth schemas (CLI-specific, for interactive login flow)
// ---------------------------------------------------------------------------

export const OAuthTokens = Schema.Struct({
  access_token: Schema.String,
  refresh_token: Schema.optional(Schema.String),
  expires_in: Schema.optional(Schema.Number),
  token_type: Schema.optional(Schema.String),
});
export type OAuthTokens = Schema.Schema.Type<typeof OAuthTokens>;

export const OAuthClientConfig = Schema.Struct({
  clientId: Schema.String,
  issuer: Schema.String,
  authorizeUrl: Schema.String,
  tokenUrl: Schema.String,
  scope: Schema.String,
  userinfoUrl: Schema.String,
});
export type OAuthClientConfig = Schema.Schema.Type<typeof OAuthClientConfig>;

export const StoredAuthData = Schema.Struct({
  refreshToken: Schema.String,
  accessToken: Schema.optional(Schema.String),
  tokenExpirationTime: Schema.optional(Schema.Number),
});
export type StoredAuthData = Schema.Schema.Type<typeof StoredAuthData>;

// ---------------------------------------------------------------------------
// Project link (.gigadrive/project.json) — links a working directory to an app
// ---------------------------------------------------------------------------

export const ProjectLink = Schema.Struct({
  applicationId: Schema.String,
  organizationId: Schema.optional(Schema.String),
});
export type ProjectLink = Schema.Schema.Type<typeof ProjectLink>;

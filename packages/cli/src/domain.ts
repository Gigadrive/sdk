import { Schema } from 'effect';

// ---------------------------------------------------------------------------
// Branded IDs
// ---------------------------------------------------------------------------

export const DeploymentId = Schema.String.pipe(Schema.brand('@Gigadrive/DeploymentId'));
export type DeploymentId = Schema.Schema.Type<typeof DeploymentId>;

export const ApplicationId = Schema.String.pipe(Schema.brand('@Gigadrive/ApplicationId'));
export type ApplicationId = Schema.Schema.Type<typeof ApplicationId>;

export const UploadId = Schema.String.pipe(Schema.brand('@Gigadrive/UploadId'));
export type UploadId = Schema.Schema.Type<typeof UploadId>;

// ---------------------------------------------------------------------------
// Domain schemas
// ---------------------------------------------------------------------------

export const DeploymentStatus = Schema.Literal('PENDING', 'BUILDING', 'PROVISIONING', 'FAILED', 'ACTIVE', 'SUSPENDED');
export type DeploymentStatus = Schema.Schema.Type<typeof DeploymentStatus>;

export const DeploymentLogType = Schema.Literal('INFO', 'ERROR', 'WARN');
export type DeploymentLogType = Schema.Schema.Type<typeof DeploymentLogType>;

export const DeploymentLog = Schema.Struct({
  id: Schema.String,
  message: Schema.String,
  type: DeploymentLogType,
  createdAt: Schema.String,
});
export type DeploymentLog = Schema.Schema.Type<typeof DeploymentLog>;

export const DeploymentLogPage = Schema.Struct({
  totalItems: Schema.Number,
  limit: Schema.Number,
  offset: Schema.Number,
  items: Schema.Array(DeploymentLog),
});
export type DeploymentLogPage = Schema.Schema.Type<typeof DeploymentLogPage>;

export const PackageManager = Schema.Literal('npm', 'yarn', 'pnpm', 'bun');
export type PackageManager = Schema.Schema.Type<typeof PackageManager>;

// ---------------------------------------------------------------------------
// OAuth schemas
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

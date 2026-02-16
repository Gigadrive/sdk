import { Schema } from 'effect';

// ---------------------------------------------------------------------------
// Auth errors
// ---------------------------------------------------------------------------

export class OAuthDiscoveryError extends Schema.TaggedError<OAuthDiscoveryError>()('OAuthDiscoveryError', {
  message: Schema.String,
  cause: Schema.optional(Schema.String),
}) {}

export class AuthStorageReadError extends Schema.TaggedError<AuthStorageReadError>()('AuthStorageReadError', {
  message: Schema.String,
}) {}

export class AuthStorageWriteError extends Schema.TaggedError<AuthStorageWriteError>()('AuthStorageWriteError', {
  message: Schema.String,
  cause: Schema.optional(Schema.String),
}) {}

export class LoginFlowError extends Schema.TaggedError<LoginFlowError>()('LoginFlowError', {
  message: Schema.String,
  cause: Schema.optional(Schema.String),
}) {}

export class TokenExchangeError extends Schema.TaggedError<TokenExchangeError>()('TokenExchangeError', {
  message: Schema.String,
  statusCode: Schema.optional(Schema.Number),
}) {}

export class TokenRefreshError extends Schema.TaggedError<TokenRefreshError>()('TokenRefreshError', {
  message: Schema.String,
  statusCode: Schema.optional(Schema.Number),
}) {}

export class NotAuthenticatedError extends Schema.TaggedError<NotAuthenticatedError>()('NotAuthenticatedError', {
  message: Schema.String,
}) {}

export class UserInfoFetchError extends Schema.TaggedError<UserInfoFetchError>()('UserInfoFetchError', {
  message: Schema.String,
  statusCode: Schema.optional(Schema.Number),
}) {}

// ---------------------------------------------------------------------------
// Project errors
// ---------------------------------------------------------------------------

export class ConfigNotFoundError extends Schema.TaggedError<ConfigNotFoundError>()('ConfigNotFoundError', {
  message: Schema.String,
  directory: Schema.String,
}) {}

export class ConfigParseError extends Schema.TaggedError<ConfigParseError>()('ConfigParseError', {
  message: Schema.String,
  cause: Schema.optional(Schema.String),
}) {}

export class ConfigValidationError extends Schema.TaggedError<ConfigValidationError>()('ConfigValidationError', {
  message: Schema.String,
  errors: Schema.Array(Schema.String),
}) {}

export class PackageJsonNotFoundError extends Schema.TaggedError<PackageJsonNotFoundError>()(
  'PackageJsonNotFoundError',
  {
    message: Schema.String,
    directory: Schema.String,
  }
) {}

export class BuildScriptNotFoundError extends Schema.TaggedError<BuildScriptNotFoundError>()(
  'BuildScriptNotFoundError',
  {
    message: Schema.String,
  }
) {}

export class PackageManagerNotFoundError extends Schema.TaggedError<PackageManagerNotFoundError>()(
  'PackageManagerNotFoundError',
  {
    message: Schema.String,
    directory: Schema.String,
  }
) {}

// ---------------------------------------------------------------------------
// Build errors
// ---------------------------------------------------------------------------

export class ExecError extends Schema.TaggedError<ExecError>()('ExecError', {
  message: Schema.String,
  command: Schema.String,
  cause: Schema.optional(Schema.String),
}) {}

// ---------------------------------------------------------------------------
// Deployment errors
// ---------------------------------------------------------------------------

export class DeploymentCreateError extends Schema.TaggedError<DeploymentCreateError>()('DeploymentCreateError', {
  message: Schema.String,
  statusCode: Schema.optional(Schema.Number),
}) {}

export class UploadStartError extends Schema.TaggedError<UploadStartError>()('UploadStartError', {
  message: Schema.String,
  statusCode: Schema.optional(Schema.Number),
}) {}

export class PresignedUrlError extends Schema.TaggedError<PresignedUrlError>()('PresignedUrlError', {
  message: Schema.String,
  partNumber: Schema.Number,
}) {}

export class UploadPartError extends Schema.TaggedError<UploadPartError>()('UploadPartError', {
  message: Schema.String,
  partNumber: Schema.Number,
}) {}

export class UploadCompleteError extends Schema.TaggedError<UploadCompleteError>()('UploadCompleteError', {
  message: Schema.String,
}) {}

export class DeploymentStatusError extends Schema.TaggedError<DeploymentStatusError>()('DeploymentStatusError', {
  message: Schema.String,
}) {}

export class DeploymentLogsFetchError extends Schema.TaggedError<DeploymentLogsFetchError>()(
  'DeploymentLogsFetchError',
  {
    message: Schema.String,
  }
) {}

export class ArchiveCreateError extends Schema.TaggedError<ArchiveCreateError>()('ArchiveCreateError', {
  message: Schema.String,
  cause: Schema.optional(Schema.String),
}) {}

export class DeploymentAuthError extends Schema.TaggedError<DeploymentAuthError>()('DeploymentAuthError', {
  message: Schema.String,
}) {}

export class DeploymentFailedError extends Schema.TaggedError<DeploymentFailedError>()('DeploymentFailedError', {
  message: Schema.String,
}) {}

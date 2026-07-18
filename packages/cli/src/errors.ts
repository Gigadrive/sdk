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

/** The device authorization request (RFC 8628 §3.1) failed. */
export class DeviceAuthorizationError extends Schema.TaggedError<DeviceAuthorizationError>()(
  'DeviceAuthorizationError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.String),
  }
) {}

/** The user denied the device login on the verification page (`access_denied`). */
export class AuthorizationDeniedError extends Schema.TaggedError<AuthorizationDeniedError>()(
  'AuthorizationDeniedError',
  {
    message: Schema.String,
  }
) {}

/** The device/user code expired before the user approved it (`expired_token`). */
export class DeviceCodeExpiredError extends Schema.TaggedError<DeviceCodeExpiredError>()('DeviceCodeExpiredError', {
  message: Schema.String,
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
// API errors
// ---------------------------------------------------------------------------

/** A request to the Gigadrive Network API failed. Wraps the SDK's `ApiError`. */
export class ApiRequestError extends Schema.TaggedError<ApiRequestError>()('ApiRequestError', {
  message: Schema.String,
  statusCode: Schema.optional(Schema.Number),
  code: Schema.optional(Schema.String),
}) {}

// ---------------------------------------------------------------------------
// Command input errors
// ---------------------------------------------------------------------------

/** An environment-variable assignment was not in `KEY=VALUE` form. */
export class InvalidEnvVarFormatError extends Schema.TaggedError<InvalidEnvVarFormatError>()(
  'InvalidEnvVarFormatError',
  {
    message: Schema.String,
  }
) {}

/** No environment variable matched the requested key or ID. */
export class EnvVarNotFoundError extends Schema.TaggedError<EnvVarNotFoundError>()('EnvVarNotFoundError', {
  message: Schema.String,
}) {}

/** The actor has no applications to link. */
export class NoApplicationsFoundError extends Schema.TaggedError<NoApplicationsFoundError>()(
  'NoApplicationsFoundError',
  {
    message: Schema.String,
  }
) {}

/** The requested application ID was not among the actor's applications. */
export class ApplicationNotFoundError extends Schema.TaggedError<ApplicationNotFoundError>()(
  'ApplicationNotFoundError',
  {
    message: Schema.String,
  }
) {}

/** The actor has no organization available for automatic application creation. */
export class NoOrganizationsFoundError extends Schema.TaggedError<NoOrganizationsFoundError>()(
  'NoOrganizationsFoundError',
  {
    message: Schema.String,
  }
) {}

// ---------------------------------------------------------------------------
// Env file / local credentials errors
// ---------------------------------------------------------------------------

/** Failed to read a local `.env` (or `.gitignore`) file. */
export class EnvFileReadError extends Schema.TaggedError<EnvFileReadError>()('EnvFileReadError', {
  message: Schema.String,
  cause: Schema.optional(Schema.String),
}) {}

/** Failed to write a local `.env` (or `.gitignore`) file. */
export class EnvFileWriteError extends Schema.TaggedError<EnvFileWriteError>()('EnvFileWriteError', {
  message: Schema.String,
  cause: Schema.optional(Schema.String),
}) {}

/** Failed to read `~/.gigadrive/dev-keys.json`. */
export class DevCredentialsStoreReadError extends Schema.TaggedError<DevCredentialsStoreReadError>()(
  'DevCredentialsStoreReadError',
  {
    message: Schema.String,
  }
) {}

/** Failed to write `~/.gigadrive/dev-keys.json`. */
export class DevCredentialsStoreWriteError extends Schema.TaggedError<DevCredentialsStoreWriteError>()(
  'DevCredentialsStoreWriteError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.String),
  }
) {}

// ---------------------------------------------------------------------------
// Project errors
// ---------------------------------------------------------------------------

export class ConfigNotFoundError extends Schema.TaggedError<ConfigNotFoundError>()('ConfigNotFoundError', {
  message: Schema.String,
  directory: Schema.String,
}) {}

/** The project directory has no `.gigadrive/project.json` link. */
export class ProjectNotLinkedError extends Schema.TaggedError<ProjectNotLinkedError>()('ProjectNotLinkedError', {
  message: Schema.String,
  directory: Schema.String,
}) {}

/** Failed to read or parse `.gigadrive/project.json`. */
export class ProjectLinkReadError extends Schema.TaggedError<ProjectLinkReadError>()('ProjectLinkReadError', {
  message: Schema.String,
  cause: Schema.optional(Schema.String),
}) {}

/** Failed to write `.gigadrive/project.json`. */
export class ProjectLinkWriteError extends Schema.TaggedError<ProjectLinkWriteError>()('ProjectLinkWriteError', {
  message: Schema.String,
  cause: Schema.optional(Schema.String),
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

export class PackageJsonParseError extends Schema.TaggedError<PackageJsonParseError>()('PackageJsonParseError', {
  message: Schema.String,
  directory: Schema.String,
  cause: Schema.optional(Schema.String),
}) {}

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

export class DeploymentHostnamesFetchError extends Schema.TaggedError<DeploymentHostnamesFetchError>()(
  'DeploymentHostnamesFetchError',
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

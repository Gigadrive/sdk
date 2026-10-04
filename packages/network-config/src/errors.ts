import { Schema } from 'effect';

export class ConfigFileNotFoundError extends Schema.TaggedError<ConfigFileNotFoundError>()('ConfigFileNotFoundError', {
  message: Schema.String,
  filePath: Schema.String,
}) {}

export class ConfigFileEmptyError extends Schema.TaggedError<ConfigFileEmptyError>()('ConfigFileEmptyError', {
  message: Schema.String,
  filePath: Schema.String,
}) {}

export class ConfigFileParseError extends Schema.TaggedError<ConfigFileParseError>()('ConfigFileParseError', {
  message: Schema.String,
  filePath: Schema.String,
  cause: Schema.optional(Schema.String),
}) {}

export class ConfigModuleLoadError extends Schema.TaggedError<ConfigModuleLoadError>()('ConfigModuleLoadError', {
  message: Schema.String,
  filePath: Schema.String,
  cause: Schema.optional(Schema.String),
}) {}

export class ConfigVersionError extends Schema.TaggedError<ConfigVersionError>()('ConfigVersionError', {
  message: Schema.String,
  filePath: Schema.String,
  version: Schema.optional(Schema.Number),
}) {}

export class ConfigSchemaValidationError extends Schema.TaggedError<ConfigSchemaValidationError>()(
  'ConfigSchemaValidationError',
  {
    message: Schema.String,
    filePath: Schema.String,
    validationErrors: Schema.Array(Schema.String),
  }
) {}

export class FunctionConfigError extends Schema.TaggedError<FunctionConfigError>()('FunctionConfigError', {
  message: Schema.String,
  functionPath: Schema.String,
}) {}

/** A `containers` entry, or a Compose file imported into one, cannot be deployed as written. */
export class ContainerConfigError extends Schema.TaggedError<ContainerConfigError>()('ContainerConfigError', {
  message: Schema.String,
  containerName: Schema.optional(Schema.String),
  filePath: Schema.optional(Schema.String),
}) {}

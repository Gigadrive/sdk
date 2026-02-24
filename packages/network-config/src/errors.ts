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

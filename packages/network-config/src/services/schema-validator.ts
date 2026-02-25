import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { Effect } from 'effect';
import { ConfigSchemaValidationError } from '../errors';

export class SchemaValidator extends Effect.Service<SchemaValidator>()('SchemaValidator', {
  effect: Effect.gen(function* () {
    const ajv = new Ajv();
    addFormats(ajv);

    /**
     * Validates a parsed config object against a JSON Schema.
     *
     * @param config - The parsed config record
     * @param schema - The JSON Schema to validate against
     * @param filePath - Path used in error messages
     */
    const validate = Effect.fn('SchemaValidator.validate')(function* (
      config: Record<string, unknown>,
      schema: object,
      filePath: string
    ) {
      const compiledValidate = ajv.compile(schema);
      const valid = compiledValidate(config);

      if (!valid) {
        const errors = compiledValidate.errors?.map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`.trim()) ?? [];
        return yield* Effect.fail(
          new ConfigSchemaValidationError({
            message: `Config file at ${filePath} is invalid: ${ajv.errorsText(compiledValidate.errors)}`,
            filePath,
            validationErrors: errors,
          })
        );
      }
    });

    return { validate };
  }),
}) {}

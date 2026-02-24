import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { SchemaValidator } from './schema-validator';

const runValidator = <A, E>(effect: Effect.Effect<A, E, SchemaValidator>) =>
  Effect.runPromise(effect.pipe(Effect.provide(SchemaValidator.Default)));

const simpleSchema = {
  type: 'object',
  required: ['version'],
  properties: {
    version: { type: 'integer', enum: [4] },
    name: { type: 'string' },
  },
};

describe('SchemaValidator', () => {
  it('should pass validation for a valid config', async () => {
    await runValidator(
      Effect.gen(function* () {
        const validator = yield* SchemaValidator;
        yield* validator.validate({ version: 4, name: 'test' }, simpleSchema, '/config.yaml');
      })
    );
  });

  it('should fail with ConfigSchemaValidationError for invalid config', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const validator = yield* SchemaValidator;
        yield* validator.validate({ version: 5 }, simpleSchema, '/config.yaml');
      }).pipe(
        Effect.catchTag('ConfigSchemaValidationError', (err) =>
          Effect.succeed({ _tag: 'caught' as const, filePath: err.filePath, errors: err.validationErrors })
        ),
        Effect.provide(SchemaValidator.Default)
      )
    );

    expect(result).toMatchObject({ _tag: 'caught', filePath: '/config.yaml' });
    expect((result as { errors: string[] }).errors.length).toBeGreaterThan(0);
  });

  it('should fail when required field is missing', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const validator = yield* SchemaValidator;
        yield* validator.validate({ name: 'test' }, simpleSchema, '/config.yaml');
      }).pipe(
        Effect.catchTag('ConfigSchemaValidationError', (err) =>
          Effect.succeed({ _tag: 'caught' as const, filePath: err.filePath })
        ),
        Effect.provide(SchemaValidator.Default)
      )
    );

    expect(result).toMatchObject({ _tag: 'caught', filePath: '/config.yaml' });
  });
});

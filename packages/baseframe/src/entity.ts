import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';

export type PrismaModels = {
  [M in Prisma.ModelName]: Exclude<Awaited<ReturnType<PrismaClient[Uncapitalize<M>]['findUnique']>>, null>;
};

export type EntitySchema<T extends keyof PrismaModels> = {
  /**
   * The name of the entity. This must match the name of the Prisma model.
   */
  entity: T;

  operations: {
    read: {
      /**
       * Defines the properties that will be exposed to the client in all responses.
       */
      properties: (keyof PrismaModels[T])[];

      /**
       * Use this to join with sub-entities.
       */
      include?: {
        [K in keyof PrismaModels[T] & Prisma.ModelName]: EntitySchema<K>;
      };

      /**
       * Defines the properties that may be used to filter the results on the collection endpoint.
       */
      filterProperties?: (keyof PrismaModels[T])[];

      /**
       * Use this to modify the data after it is read from the database.
       *
       * Returning void will not apply any modifications.
       * Returning null will return HTTP 204 No Content.
       */
      onRead?: (data: PrismaModels[T]) => Promise<PrismaModels[T] | void | null>;
    };
    /**
     * If defined, this entity will expose a POST endpoint for creating a new record.
     * The request body will be validated against this schema.
     */
    create?: {
      enabled: boolean;
      schema: z.ZodType<Partial<PrismaModels[T]>>;

      /**
       * Hook that runs before the record is created.
       *
       * Throwing an error will cancel the creation.
       */
      beforeCreate?: (data: PrismaModels[T]) => Promise<void>;

      /**
       * Use this to modify the data after it is created.
       *
       * Returning void will not apply any modifications.
       */
      onCreate?: (data: PrismaModels[T]) => Promise<PrismaModels[T] | void>;
    };
    /**
     * If defined, this entity will expose a PATCH endpoint for updating an existing record.
     * The request body will be validated against the provided schema.
     */
    update?: {
      enabled: boolean;
      schema: z.ZodType<Partial<PrismaModels[T]>>;

      /**
       * Hook that runs before the record is updated.
       *
       * Throwing an error will cancel the update.
       */
      beforeUpdate?: (data: PrismaModels[T]) => Promise<void>;

      /**
       * Use this to modify the data after it is updated.
       *
       * Returning void will not apply any modifications.
       */
      onUpdate?: (data: PrismaModels[T]) => Promise<PrismaModels[T] | void>;
    };
    /**
     * If defined, this entity will expose a DELETE endpoint for deleting a record.
     */
    delete?: {
      enabled: boolean;

      /**
       * Hook that runs before the record is deleted.
       *
       * Throwing an error will cancel deletion.
       */
      beforeDelete?: (data: PrismaModels[T]) => Promise<void>;

      /**
       * Hook that runs after the record is deleted.
       */
      onDelete?: (data: PrismaModels[T]) => Promise<void>;
    };
  };
};

export const defineEntitySchema = <T extends keyof PrismaModels>(schema: EntitySchema<T>): EntitySchema<T> => {
  return schema;
};

const userSchema = defineEntitySchema({
  entity: 'User',
  operations: {
    read: {
      properties: ['id', 'email'],
    },
    create: {
      enabled: true,
      schema: z.object({
        email: z.string().email(),
      }),
    },
  },
});

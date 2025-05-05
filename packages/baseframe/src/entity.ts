import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { BaseframeOptionsPrismaOnly } from '.';

export type PrismaModels = {
  [M in Prisma.ModelName]: Exclude<Awaited<ReturnType<PrismaClient[Uncapitalize<M>]['findUnique']>>, null>;
};

export type PrismaFindUniqueArgs<T = keyof PrismaModels> = Prisma.Args<
  PrismaClient[Uncapitalize<T & keyof PrismaModels>],
  'findUnique'
>;
export type PrismaFindManyArgs<T = keyof PrismaModels> = Prisma.Args<
  PrismaClient[Uncapitalize<T & keyof PrismaModels>],
  'findMany'
>;
export type PrismaCreateArgs<T = keyof PrismaModels> = Prisma.Args<
  PrismaClient[Uncapitalize<T & keyof PrismaModels>],
  'create'
>;
export type PrismaUpdateArgs<T = keyof PrismaModels> = Prisma.Args<
  PrismaClient[Uncapitalize<T & keyof PrismaModels>],
  'update'
>;
export type PrismaDeleteArgs<T = keyof PrismaModels> = Prisma.Args<
  PrismaClient[Uncapitalize<T & keyof PrismaModels>],
  'delete'
>;
export type PrismaSelect<T = keyof PrismaModels> = Prisma.Args<
  PrismaClient[Uncapitalize<T & keyof PrismaModels>],
  'findUnique'
>['select'];

export const prismaModel = <T extends keyof PrismaModels>(entity: T, client: PrismaClient) => {
  return client[entity.toLowerCase() as Uncapitalize<T>] as unknown as {
    findUnique: (args: PrismaFindUniqueArgs<T>) => Promise<PrismaModels[T] | null>;
    findMany: (args?: PrismaFindManyArgs<T>) => Promise<PrismaModels[T][]>;
    create: (args: PrismaCreateArgs<T>) => Promise<PrismaModels[T]>;
    update: (args: PrismaUpdateArgs<T>) => Promise<PrismaModels[T]>;
    delete: (args: PrismaDeleteArgs<T>) => Promise<PrismaModels[T]>;
  };
};

/**
 * Retrieves a single entity by its ID from the database.
 *
 * @param entityType - The Prisma model name of the entity to retrieve
 * @param id - The ID value to look up. Can be string or number depending on the model's ID field type
 * @param options - Baseframe options containing the Prisma client instance
 * @returns The found entity or null if not found
 * @throws Error if the entity type is invalid or has no ID field
 */
export const getById = async <T extends keyof PrismaModels = keyof PrismaModels>(
  entityTypeOrSchema: T | EntitySchema<T>,
  id: string | number,
  options: BaseframeOptionsPrismaOnly
): Promise<PrismaModels[T] | null> => {
  const entityType = typeof entityTypeOrSchema === 'string' ? entityTypeOrSchema : entityTypeOrSchema.entity;

  const entity = prismaModel<keyof PrismaModels>(entityType, options.prisma);

  const modelFields = Prisma.dmmf.datamodel.models.find((m) => m.name === entityType)?.fields;

  if (!modelFields) {
    console.error(`No model fields found for entity ${entityType}`);
    throw new Error('Not found'); // TODO: proper Exception
  }

  const idField = modelFields.find((f) => f.isId === true);

  if (!idField) {
    console.error(`No id field found for entity ${entityType}`);
    throw new Error('Not found'); // TODO: proper Exception
  }

  const idType = idField.type;

  return (await entity.findUnique({
    // @ts-expect-error - we explicitly check against Prisma's DMMF for the type
    where: {
      [idField.name]: (idType === 'Int' || idType === 'BigInt') && typeof id === 'string' ? parseInt(id) : id,
    },
  })) as PrismaModels[T] | null;
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
      /*include?: {
        [K in keyof PrismaModels[T] & Prisma.ModelName]: EntitySchema<K>;
      };*/

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

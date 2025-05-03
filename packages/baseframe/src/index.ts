import { EntitySchema, PrismaModels } from './entity';

export * from './entity';

export interface BaseframeOptions {
  entities: EntitySchema<keyof PrismaModels>[];
}

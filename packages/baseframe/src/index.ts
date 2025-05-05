import { PartialWithRequired } from '@gigadrive/commons';
import { PrismaClient } from '@prisma/client';
import { EntitySchema, PrismaModels } from './entity';
export * from './entity';

export interface BaseframeOptions {
  entities: EntitySchema<keyof PrismaModels>[];
  prisma: PrismaClient;
}

export type BaseframeOptionsPrismaOnly = PartialWithRequired<BaseframeOptions, 'prisma'>;

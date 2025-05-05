import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { prisma, resetDB } from '../tests/helpers/db';
import { defineEntitySchema, getById } from './entity';

describe('entity', () => {
  beforeEach(async () => {
    await resetDB();
  });

  describe('defineEntitySchema', () => {
    it('should define a valid entity schema', () => {
      const userSchema = defineEntitySchema({
        entity: 'User',
        operations: {
          read: {
            properties: ['id', 'email', 'name', 'createdAt', 'updatedAt'],
          },
          create: {
            enabled: true,
            schema: z.object({
              email: z.string().email(),
              name: z.string().optional(),
            }),
          },
          update: {
            enabled: true,
            schema: z.object({
              name: z.string().optional(),
              email: z.string().email().optional(),
            }),
          },
          delete: {
            enabled: true,
          },
        },
      });

      expect(userSchema.entity).toBe('User');
      expect(userSchema.operations.read.properties).toContain('email');
      expect(userSchema.operations.create?.enabled).toBe(true);
      expect(userSchema.operations.update?.enabled).toBe(true);
      expect(userSchema.operations.delete?.enabled).toBe(true);
    });
  });

  describe('getById', () => {
    it('should retrieve a user by id', async () => {
      const user = await prisma.user.findFirst();
      expect(user).not.toBeNull();

      const userSchema = defineEntitySchema({
        entity: 'User',
        operations: {
          read: {
            properties: ['id', 'email', 'name'],
          },
        },
      });

      const foundUser = await getById(userSchema, user!.id, { prisma });
      expect(foundUser).toBeDefined();
      expect(foundUser?.id).toBe(user!.id);
      expect(foundUser?.email).toBe(user!.email);
    });

    it('should return null for non-existent id', async () => {
      const userSchema = defineEntitySchema({
        entity: 'User',
        operations: {
          read: {
            properties: ['id', 'email', 'name'],
          },
        },
      });

      const nonExistentUser = await getById(userSchema, 99999, { prisma });
      expect(nonExistentUser).toBeNull();
    });
  });
});

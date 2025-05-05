import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export const resetDB = async () => {
  await prisma.$transaction([prisma.user.deleteMany(), prisma.post.deleteMany()]);

  await seedDB();
};

export const seedDB = async () => {
  await prisma.user.create({
    data: { name: 'John Doe', email: 'john.doe@example.com' },
  });
};

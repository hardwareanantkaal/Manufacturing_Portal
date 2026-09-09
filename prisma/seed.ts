import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  await prisma.counter.upsert({
    where: { name: 'device_serial' },
    update: {},
    create: { name: 'device_serial', value: 0 },
  });

  await prisma.admin.upsert({
    where: { email: 'admin@anantkaal.com' },
    update: {},
    create: {
      email: 'admin@anantkaal.com',
      name: 'Admin',
      passwordHash: await bcrypt.hash('changeme123', 10),
    },
  });

  console.log('Seeded.');
}

main().finally(() => prisma.$disconnect());
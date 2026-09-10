import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  await prisma.counter.upsert({
    where: { name: 'device_serial' },
    update: {},
    create: { name: 'device_serial', value: 0 },
  });

  const passwordHash = await bcrypt.hash('Setupdev@123', 10);

  // Remove legacy default admin if exists
  await prisma.admin.deleteMany({
    where: { email: 'admin@anantkaal.com' },
  });

  // Upsert target admin account
  await prisma.admin.upsert({
    where: { email: 'hardware.anantkaal@gmail.com' },
    update: {
      name: 'Anantkaal Admin',
      passwordHash,
    },
    create: {
      email: 'hardware.anantkaal@gmail.com',
      name: 'Anantkaal Admin',
      passwordHash,
    },
  });

  console.log('Seeded admin account: hardware.anantkaal@gmail.com');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
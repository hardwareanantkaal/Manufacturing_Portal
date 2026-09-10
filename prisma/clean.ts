import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning dummy data...');

  // Delete dependent records first to maintain relational integrity
  await prisma.readingHourly.deleteMany({});
  await prisma.reading.deleteMany({});
  await prisma.otaTarget.deleteMany({});
  await prisma.otaJob.deleteMany({});
  await prisma.firmware.deleteMany({});
  await prisma.device.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.client.deleteMany({});

  // Reset device serial counters
  await prisma.counter.deleteMany({});
  await prisma.counter.create({
    data: { name: 'device_serial', value: 0 },
  });

  console.log('Dummy data successfully removed. Admin account preserved.');
}

main()
  .catch((e) => {
    console.error('Error cleaning database:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

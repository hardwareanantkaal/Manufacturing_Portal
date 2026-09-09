import { prisma } from "@/lib/prisma";

// Serials are unique per product, not globally, so each product gets its
// own counter row — same Counter table, just one row per product instead
// of one global row.
export async function nextSerial(productId: string): Promise<string> {
  const counter = await prisma.$transaction((tx) =>
    tx.counter.upsert({
      where: { name: `device_serial:${productId}` },
      update: { value: { increment: 1 } },
      create: { name: `device_serial:${productId}`, value: 1 },
    })
  );
  return String(counter.value).padStart(6, "0");
}

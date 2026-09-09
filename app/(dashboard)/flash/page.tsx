import { prisma } from "@/lib/prisma";
import { FlashStation } from "./flash-station";

export default async function FlashPage() {
  const [clients, products] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      include: { firmwares: { orderBy: { createdAt: "desc" } } },
    }),
  ]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Flash Station</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Flash firmware over USB and register the device in one step.
        </p>
      </div>

      <FlashStation clients={clients} products={products} />
    </div>
  );
}

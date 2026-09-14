-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "clientId" TEXT;

-- Backfill: any device that's already been claimed keeps the client it
-- effectively already belonged to (via its product), so existing client
-- portals don't lose devices they could already see. Unclaimed devices are
-- deliberately left NULL — that's the new "no client identified yet" state.
UPDATE "Device" d
SET "clientId" = p."clientId"
FROM "Product" p
WHERE d."productId" = p.id AND d."claimedAt" IS NOT NULL;

-- CreateIndex
CREATE INDEX "Device_clientId_idx" ON "Device"("clientId");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

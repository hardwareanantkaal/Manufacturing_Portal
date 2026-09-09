-- Add claimToken as nullable first, backfill existing rows, then enforce NOT NULL + UNIQUE.
-- md5(random) yields a 32-character hex string, matching the app's own token format.
ALTER TABLE "Device" ADD COLUMN "claimToken" TEXT;

UPDATE "Device" SET "claimToken" = md5(random()::text || clock_timestamp()::text) WHERE "claimToken" IS NULL;

ALTER TABLE "Device" ALTER COLUMN "claimToken" SET NOT NULL;

CREATE UNIQUE INDEX "Device_claimToken_key" ON "Device"("claimToken");

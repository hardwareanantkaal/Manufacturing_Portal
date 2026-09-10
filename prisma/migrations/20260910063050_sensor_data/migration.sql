-- Sensor data collection: Reading model, product API config, device data cache.

ALTER TABLE "Product" ADD COLUMN "productKey" TEXT;
ALTER TABLE "Product" ADD COLUMN "apiKey" TEXT;
ALTER TABLE "Product" ADD COLUMN "sensorSchema" JSONB;
ALTER TABLE "Product" ADD COLUMN "readInterval" INTEGER NOT NULL DEFAULT 300;

-- Backfill existing rows before enforcing NOT NULL + UNIQUE, so the
-- migration doesn't fail on the constraint. productKey is a slug of the
-- name; apiKey is a random 32-char hex string (md5 output length).
UPDATE "Product"
SET "productKey" = lower(
      regexp_replace(
        trim(both '-' from regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')),
        '-+', '-', 'g'
      )
    ),
    "apiKey" = md5(random()::text || clock_timestamp()::text || id)
WHERE "productKey" IS NULL;

ALTER TABLE "Product" ALTER COLUMN "productKey" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "apiKey" SET NOT NULL;

CREATE UNIQUE INDEX "Product_productKey_key" ON "Product"("productKey");
CREATE UNIQUE INDEX "Product_apiKey_key" ON "Product"("apiKey");

-- Device: cached copy of the latest reading, for fast fleet-list rendering.
ALTER TABLE "Device" ADD COLUMN "lastPayload" JSONB;
ALTER TABLE "Device" ADD COLUMN "lastReadingAt" TIMESTAMP(3);

CREATE TABLE "Reading" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "rssi" INTEGER,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reading_pkey" PRIMARY KEY ("id")
);

-- Keeps time-range queries fast — do not omit.
CREATE INDEX "Reading_deviceId_recordedAt_idx" ON "Reading"("deviceId", "recordedAt");

ALTER TABLE "Reading" ADD CONSTRAINT "Reading_deviceId_fkey"
    FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

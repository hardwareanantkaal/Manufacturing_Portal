-- CreateTable
CREATE TABLE "ReadingHourly" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "hour" TIMESTAMP(3) NOT NULL,
    "avg" JSONB NOT NULL,
    "min" JSONB NOT NULL,
    "max" JSONB NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "ReadingHourly_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReadingHourly_deviceId_hour_idx" ON "ReadingHourly"("deviceId", "hour");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingHourly_deviceId_hour_key" ON "ReadingHourly"("deviceId", "hour");

-- AddForeignKey
ALTER TABLE "ReadingHourly" ADD CONSTRAINT "ReadingHourly_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT NOT NULL,

    CONSTRAINT "ClientUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "chipFamily" TEXT NOT NULL,
    "isCellular" BOOLEAN NOT NULL DEFAULT false,
    "modemModel" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productKey" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "sensorSchema" JSONB,
    "readInterval" INTEGER NOT NULL DEFAULT 300,
    "clientId" TEXT NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "mac" TEXT NOT NULL,
    "claimToken" TEXT,
    "claimedAt" TIMESTAMP(3),
    "state" TEXT NOT NULL DEFAULT 'flashed',
    "fwVersion" TEXT,
    "notes" TEXT,
    "imei" TEXT,
    "iccid" TEXT,
    "operator" TEXT,
    "lastRssi" INTEGER,
    "lastSeenAt" TIMESTAMP(3),
    "lastIp" TEXT,
    "flashedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastPayload" JSONB,
    "lastReadingAt" TIMESTAMP(3),
    "productId" TEXT NOT NULL,
    "clientId" TEXT,
    "flashedById" TEXT,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reading" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "rssi" INTEGER,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reading_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "Firmware" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "binUrl" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'stable',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" TEXT NOT NULL,

    CONSTRAINT "Firmware_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtaJob" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "firmwareId" TEXT NOT NULL,
    "createdById" TEXT,
    "triggeredByClientId" TEXT,

    CONSTRAINT "OtaJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtaTarget" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "jobId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,

    CONSTRAINT "OtaTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counter" (
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE INDEX "Client_name_idx" ON "Client"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ClientUser_email_key" ON "ClientUser"("email");

-- CreateIndex
CREATE INDEX "ClientUser_clientId_idx" ON "ClientUser"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_productKey_key" ON "Product"("productKey");

-- CreateIndex
CREATE UNIQUE INDEX "Product_apiKey_key" ON "Product"("apiKey");

-- CreateIndex
CREATE INDEX "Product_clientId_idx" ON "Product"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_clientId_name_key" ON "Product"("clientId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Device_mac_key" ON "Device"("mac");

-- CreateIndex
CREATE UNIQUE INDEX "Device_claimToken_key" ON "Device"("claimToken");

-- CreateIndex
CREATE UNIQUE INDEX "Device_imei_key" ON "Device"("imei");

-- CreateIndex
CREATE INDEX "Device_productId_idx" ON "Device"("productId");

-- CreateIndex
CREATE INDEX "Device_clientId_idx" ON "Device"("clientId");

-- CreateIndex
CREATE INDEX "Device_state_idx" ON "Device"("state");

-- CreateIndex
CREATE INDEX "Device_lastSeenAt_idx" ON "Device"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "Device_productId_serial_key" ON "Device"("productId", "serial");

-- CreateIndex
CREATE INDEX "Reading_deviceId_recordedAt_idx" ON "Reading"("deviceId", "recordedAt");

-- CreateIndex
CREATE INDEX "ReadingHourly_deviceId_hour_idx" ON "ReadingHourly"("deviceId", "hour");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingHourly_deviceId_hour_key" ON "ReadingHourly"("deviceId", "hour");

-- CreateIndex
CREATE INDEX "Firmware_productId_idx" ON "Firmware"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Firmware_productId_version_key" ON "Firmware"("productId", "version");

-- CreateIndex
CREATE INDEX "OtaJob_firmwareId_idx" ON "OtaJob"("firmwareId");

-- CreateIndex
CREATE INDEX "OtaJob_status_idx" ON "OtaJob"("status");

-- CreateIndex
CREATE INDEX "OtaJob_triggeredByClientId_idx" ON "OtaJob"("triggeredByClientId");

-- CreateIndex
CREATE INDEX "OtaTarget_deviceId_idx" ON "OtaTarget"("deviceId");

-- CreateIndex
CREATE INDEX "OtaTarget_status_idx" ON "OtaTarget"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OtaTarget_jobId_deviceId_key" ON "OtaTarget"("jobId", "deviceId");

-- AddForeignKey
ALTER TABLE "ClientUser" ADD CONSTRAINT "ClientUser_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_flashedById_fkey" FOREIGN KEY ("flashedById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reading" ADD CONSTRAINT "Reading_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingHourly" ADD CONSTRAINT "ReadingHourly_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Firmware" ADD CONSTRAINT "Firmware_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtaJob" ADD CONSTRAINT "OtaJob_firmwareId_fkey" FOREIGN KEY ("firmwareId") REFERENCES "Firmware"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtaJob" ADD CONSTRAINT "OtaJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtaJob" ADD CONSTRAINT "OtaJob_triggeredByClientId_fkey" FOREIGN KEY ("triggeredByClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtaTarget" ADD CONSTRAINT "OtaTarget_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "OtaJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtaTarget" ADD CONSTRAINT "OtaTarget_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

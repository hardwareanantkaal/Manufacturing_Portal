-- Client portal (site 2): per-user client logins, and single-use device claiming.

-- Superseded by ClientUser (one password per client org was never wired to any
-- real login flow, and no client has one set).
ALTER TABLE "Client" DROP COLUMN "passwordHash";

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

CREATE UNIQUE INDEX "ClientUser_email_key" ON "ClientUser"("email");
CREATE INDEX "ClientUser_clientId_idx" ON "ClientUser"("clientId");

ALTER TABLE "ClientUser" ADD CONSTRAINT "ClientUser_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- claimToken becomes nullable so it can be cleared (single-use) once a
-- device is claimed; claimedAt records when that happened.
ALTER TABLE "Device" ALTER COLUMN "claimToken" DROP NOT NULL;
ALTER TABLE "Device" ADD COLUMN "claimedAt" TIMESTAMP(3);

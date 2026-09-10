-- Track which OTA jobs were triggered by a client portal user rather than staff.
ALTER TABLE "OtaJob" ADD COLUMN "triggeredByClientId" TEXT;

CREATE INDEX "OtaJob_triggeredByClientId_idx" ON "OtaJob"("triggeredByClientId");

ALTER TABLE "OtaJob" ADD CONSTRAINT "OtaJob_triggeredByClientId_fkey"
    FOREIGN KEY ("triggeredByClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

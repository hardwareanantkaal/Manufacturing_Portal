// Rolls up raw Reading rows older than ROLLUP_CUTOFF_DAYS into hourly
// ReadingHourly buckets, then deletes raw Reading rows older than
// DELETE_CUTOFF_DAYS — but only once a matching hourly bucket already
// exists for them, so nothing is ever deleted before it's been rolled up.
//
// Idempotent: re-running is safe. Rollup upserts by (deviceId, hour), and
// the delete step only touches rows that already have a rollup counterpart.
//
// Not scheduled yet — run manually with `npx tsx scripts/rollup.ts` once
// there's enough real data volume to be worth rolling up.

import { prisma } from "../lib/prisma";

const ROLLUP_CUTOFF_DAYS = 7;
const DELETE_CUTOFF_DAYS = 90;
const HOUR_MS = 60 * 60 * 1000;

type PendingHour = { hour: Date };

async function rollupDevice(deviceId: string, rollupCutoff: Date) {
  // Hours with raw data older than the cutoff that don't have a rollup row yet.
  const pending = await prisma.$queryRaw<PendingHour[]>`
    SELECT DISTINCT date_trunc('hour', r."recordedAt") AS hour
    FROM "Reading" r
    WHERE r."deviceId" = ${deviceId}
      AND r."recordedAt" < ${rollupCutoff}
      AND NOT EXISTS (
        SELECT 1 FROM "ReadingHourly" rh
        WHERE rh."deviceId" = r."deviceId" AND rh.hour = date_trunc('hour', r."recordedAt")
      )
    ORDER BY hour ASC
  `;

  let rolledUp = 0;
  for (const { hour } of pending) {
    const hourEnd = new Date(hour.getTime() + HOUR_MS);
    const readings = await prisma.reading.findMany({
      where: { deviceId, recordedAt: { gte: hour, lt: hourEnd } },
      select: { payload: true },
    });
    if (readings.length === 0) continue;

    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};
    const mins: Record<string, number> = {};
    const maxs: Record<string, number> = {};

    for (const r of readings) {
      const payload = r.payload as Record<string, unknown>;
      for (const [key, value] of Object.entries(payload)) {
        if (typeof value !== "number") continue;
        sums[key] = (sums[key] ?? 0) + value;
        counts[key] = (counts[key] ?? 0) + 1;
        mins[key] = key in mins ? Math.min(mins[key], value) : value;
        maxs[key] = key in maxs ? Math.max(maxs[key], value) : value;
      }
    }

    const avg: Record<string, number> = {};
    for (const key of Object.keys(sums)) avg[key] = sums[key] / counts[key];

    await prisma.readingHourly.upsert({
      where: { deviceId_hour: { deviceId, hour } },
      create: { deviceId, hour, avg, min: mins, max: maxs, count: readings.length },
      update: { avg, min: mins, max: maxs, count: readings.length },
    });
    rolledUp++;
  }

  return rolledUp;
}

async function deleteRolledUpRawReadings(deleteCutoff: Date) {
  const result = await prisma.$executeRaw`
    DELETE FROM "Reading" r
    WHERE r."recordedAt" < ${deleteCutoff}
      AND EXISTS (
        SELECT 1 FROM "ReadingHourly" rh
        WHERE rh."deviceId" = r."deviceId" AND rh.hour = date_trunc('hour', r."recordedAt")
      )
  `;
  return result;
}

async function main() {
  const now = Date.now();
  const rollupCutoff = new Date(now - ROLLUP_CUTOFF_DAYS * 24 * HOUR_MS);
  const deleteCutoff = new Date(now - DELETE_CUTOFF_DAYS * 24 * HOUR_MS);

  const devices = await prisma.device.findMany({ select: { id: true } });

  let totalHours = 0;
  for (const device of devices) {
    totalHours += await rollupDevice(device.id, rollupCutoff);
  }
  console.log(`Rolled up ${totalHours} device-hours across ${devices.length} devices.`);

  const deleted = await deleteRolledUpRawReadings(deleteCutoff);
  console.log(`Deleted ${deleted} raw readings older than ${DELETE_CUTOFF_DAYS} days (rolled-up only).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

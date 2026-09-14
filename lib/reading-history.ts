import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const HISTORY_RANGES = ["24h", "7d", "30d"] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];

export function isHistoryRange(value: string | undefined): value is HistoryRange {
  return HISTORY_RANGES.includes(value as HistoryRange);
}

export function rangeToSince(range: HistoryRange): Date {
  const ms = { "24h": 24 * 60 * 60 * 1000, "7d": 7 * 24 * 60 * 60 * 1000, "30d": 30 * 24 * 60 * 60 * 1000 }[range];
  return new Date(Date.now() - ms);
}

export type Granularity = "5min" | "hour" | "day";

// 24h buckets at 5 minutes, not 1 hour — a device that's only been sending
// data for the last 20 minutes (fresh flash, active testing) would otherwise
// collapse into a single hourly bucket and render as one dot, which reads as
// "the chart is broken" even though the aggregation is technically correct.
// 7d buckets by hour, 30d by day, or those charts would be thousands of points.
export function rangeToGranularity(range: HistoryRange): Granularity {
  if (range === "30d") return "day";
  if (range === "7d") return "hour";
  return "5min";
}

export type HistoryBucket = { bucket: Date; avg: number | null; min: number | null; max: number | null };

// scripts/rollup.ts only ever rolls up hours older than this many days, and
// only deletes raw readings once they're rolled up — so a day-granularity
// query can safely read everything older than this cutoff from
// ReadingHourly and everything from this cutoff forward from raw Reading,
// with no gap and no overlap (the split lands on a day boundary so the two
// sources never both contribute to the same bucket).
const ROLLUP_CUTOFF_DAYS = 7;

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Daily avg is count-weighted across the hourly rows that make up each day,
// not a plain average-of-averages.
async function queryFieldHistoryFromHourly(
  deviceId: string,
  sensorKey: string,
  since: Date,
  until: Date
): Promise<HistoryBucket[]> {
  return prisma.$queryRaw<HistoryBucket[]>`
    SELECT
      date_trunc('day', hour) AS bucket,
      SUM((avg->>${sensorKey})::float * count) / NULLIF(SUM(count) FILTER (WHERE avg->>${sensorKey} IS NOT NULL), 0) AS avg,
      MIN((min->>${sensorKey})::float) AS min,
      MAX((max->>${sensorKey})::float) AS max
    FROM "ReadingHourly"
    WHERE "deviceId" = ${deviceId}
      AND hour >= ${since}
      AND hour < ${until}
      AND avg->>${sensorKey} IS NOT NULL
    GROUP BY bucket
    ORDER BY bucket ASC
  `;
}

async function queryFieldHistoryFromRaw(
  deviceId: string,
  sensorKey: string,
  since: Date,
  granularity: Granularity
): Promise<HistoryBucket[]> {
  // date_trunc() has no "5 minutes" unit — truncate to the hour, then add a
  // floored 5-minute offset within it to get 5-minute-aligned buckets.
  const bucketExpr =
    granularity === "5min"
      ? Prisma.sql`date_trunc('hour', "recordedAt") + interval '5 min' * floor(extract(minute from "recordedAt") / 5)`
      : Prisma.sql`date_trunc(${granularity}, "recordedAt")`;

  return prisma.$queryRaw<HistoryBucket[]>`
    SELECT
      ${bucketExpr} AS bucket,
      AVG((payload->>${sensorKey})::float) AS avg,
      MIN((payload->>${sensorKey})::float) AS min,
      MAX((payload->>${sensorKey})::float) AS max
    FROM "Reading"
    WHERE "deviceId" = ${deviceId}
      AND "recordedAt" >= ${since}
      AND payload->>${sensorKey} IS NOT NULL
    GROUP BY bucket
    ORDER BY bucket ASC
  `;
}

export async function queryFieldHistory(
  deviceId: string,
  sensorKey: string,
  range: HistoryRange
): Promise<HistoryBucket[]> {
  const since = rangeToSince(range);
  const granularity = rangeToGranularity(range);

  if (granularity !== "day") {
    return queryFieldHistoryFromRaw(deviceId, sensorKey, since, granularity);
  }

  const dayCutoff = startOfUtcDay(new Date(Date.now() - ROLLUP_CUTOFF_DAYS * 24 * 60 * 60 * 1000));
  const [hourlyBuckets, rawBuckets] = await Promise.all([
    queryFieldHistoryFromHourly(deviceId, sensorKey, since, dayCutoff),
    queryFieldHistoryFromRaw(deviceId, sensorKey, dayCutoff > since ? dayCutoff : since, "day"),
  ]);
  return [...hourlyBuckets, ...rawBuckets];
}

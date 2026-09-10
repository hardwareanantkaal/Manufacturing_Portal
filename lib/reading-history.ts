import { prisma } from "@/lib/prisma";

export const HISTORY_RANGES = ["24h", "7d", "30d"] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];

export function isHistoryRange(value: string | undefined): value is HistoryRange {
  return HISTORY_RANGES.includes(value as HistoryRange);
}

export function rangeToSince(range: HistoryRange): Date {
  const ms = { "24h": 24 * 60 * 60 * 1000, "7d": 7 * 24 * 60 * 60 * 1000, "30d": 30 * 24 * 60 * 60 * 1000 }[range];
  return new Date(Date.now() - ms);
}

// 24h/7d bucket by hour so the chart has enough points to be useful;
// 30d buckets by day or an hourly chart would be thousands of points.
export function rangeToGranularity(range: HistoryRange): "hour" | "day" {
  return range === "30d" ? "day" : "hour";
}

export type HistoryBucket = { bucket: Date; avg: number | null; min: number | null; max: number | null };

export async function queryFieldHistory(
  deviceId: string,
  sensorKey: string,
  range: HistoryRange
): Promise<HistoryBucket[]> {
  const since = rangeToSince(range);
  const granularity = rangeToGranularity(range);

  return prisma.$queryRaw<HistoryBucket[]>`
    SELECT
      date_trunc(${granularity}, "recordedAt") AS bucket,
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

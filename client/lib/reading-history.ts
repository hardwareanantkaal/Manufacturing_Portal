import { prisma } from "@/lib/prisma";

export const HISTORY_RANGES = ["24h", "7d", "30d", "custom"] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];

export function isHistoryRange(value: string | undefined): value is HistoryRange {
  return HISTORY_RANGES.includes(value as HistoryRange);
}

export type ResolvedRange = { since: Date; until: Date; granularity: "hour" | "day" };

const DAY_MS = 24 * 60 * 60 * 1000;

// Custom ranges span an admin-picked window rather than a fixed bucket count,
// so the hour/day cutoff is based on the actual span, not the range label.
export function resolveRange(range: HistoryRange, customFrom?: string, customTo?: string): ResolvedRange {
  const until = range === "custom" && customTo ? new Date(customTo) : new Date();

  if (range === "custom") {
    const since = customFrom ? new Date(customFrom) : new Date(until.getTime() - DAY_MS);
    const spanMs = until.getTime() - since.getTime();
    return { since, until, granularity: spanMs > 3 * DAY_MS ? "day" : "hour" };
  }

  const spanMs = { "24h": DAY_MS, "7d": 7 * DAY_MS, "30d": 30 * DAY_MS }[range];
  return { since: new Date(until.getTime() - spanMs), until, granularity: range === "30d" ? "day" : "hour" };
}

export type HistoryBucket = { bucket: Date; avg: number | null; min: number | null; max: number | null };

// scripts/rollup.ts (portal) only rolls up hours older than this many days,
// and only deletes raw readings once rolled up — so day-granularity queries
// (30d, or a long custom range) read anything older than this cutoff from
// ReadingHourly and anything from the cutoff forward from raw Reading. The
// split lands on a day boundary so the two sources never touch the same bucket.
const ROLLUP_CUTOFF_DAYS = 7;

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

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
  until: Date,
  granularity: "hour" | "day"
): Promise<HistoryBucket[]> {
  return prisma.$queryRaw<HistoryBucket[]>`
    SELECT
      date_trunc(${granularity}, "recordedAt") AS bucket,
      AVG((payload->>${sensorKey})::float) AS avg,
      MIN((payload->>${sensorKey})::float) AS min,
      MAX((payload->>${sensorKey})::float) AS max
    FROM "Reading"
    WHERE "deviceId" = ${deviceId}
      AND "recordedAt" >= ${since}
      AND "recordedAt" <= ${until}
      AND payload->>${sensorKey} IS NOT NULL
    GROUP BY bucket
    ORDER BY bucket ASC
  `;
}

export async function queryFieldHistory(
  deviceId: string,
  sensorKey: string,
  resolved: ResolvedRange
): Promise<HistoryBucket[]> {
  const { since, until, granularity } = resolved;

  if (granularity !== "day") {
    return queryFieldHistoryFromRaw(deviceId, sensorKey, since, until, granularity);
  }

  const dayCutoff = startOfUtcDay(new Date(Date.now() - ROLLUP_CUTOFF_DAYS * DAY_MS));
  const hourlyUntil = until < dayCutoff ? until : dayCutoff;
  const rawSince = since > dayCutoff ? since : dayCutoff;

  const [hourlyBuckets, rawBuckets] = await Promise.all([
    since < hourlyUntil ? queryFieldHistoryFromHourly(deviceId, sensorKey, since, hourlyUntil) : [],
    rawSince <= until ? queryFieldHistoryFromRaw(deviceId, sensorKey, rawSince, until, "day") : [],
  ]);
  return [...hourlyBuckets, ...rawBuckets];
}

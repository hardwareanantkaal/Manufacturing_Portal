import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkPendingOta } from "@/lib/ota-check";

const MAC_REGEX = /^[0-9A-Fa-f]{12}$/;

type ReadingInput = {
  payload?: unknown;
  rssi?: unknown;
  ts?: unknown;
};

// Body is either a single reading:
//   { mac, fw?, payload, rssi? }
// or a batch (buffered-while-offline upload), where mac/fw stay top-level
// and each buffered reading carries its own payload/rssi/ts:
//   { mac, fw?, readings: [{ payload, rssi?, ts? }, ...] }
type Body = {
  mac?: string;
  fw?: string;
  payload?: unknown;
  rssi?: unknown;
  readings?: ReadingInput[];
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ productKey: string }> }
) {
  const { productKey } = await params;

  const product = await prisma.product.findUnique({ where: { productKey } });
  if (!product) {
    return NextResponse.json({ error: "Unknown product" }, { status: 404 });
  }

  // Check the API key before touching the body — no point parsing a
  // request we're about to reject.
  const apiKey = request.headers.get("x-api-key");
  if (apiKey !== product.apiKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { mac, fw } = body;
  if (!mac || !MAC_REGEX.test(mac)) {
    return NextResponse.json(
      { error: "mac must be 12 hex characters, e.g. AABBCCDDEEFF" },
      { status: 400 }
    );
  }

  const normalizedMac = mac.toUpperCase();

  const device = await prisma.device.findUnique({ where: { mac: normalizedMac } });
  // Devices are created at flash time, never auto-created by whoever posts
  // first — an unrecognized MAC or one under a different product is a 404,
  // not an implicit registration.
  if (!device || device.productId !== product.id) {
    return NextResponse.json({ error: "Unknown device for this product" }, { status: 404 });
  }

  // Normalize to a list of { payload, rssi, recordedAt } regardless of
  // whether the caller sent a single reading or a batch.
  const rawReadings: ReadingInput[] = Array.isArray(body.readings)
    ? body.readings
    : [{ payload: body.payload, rssi: body.rssi }];

  if (rawReadings.length === 0) {
    return NextResponse.json({ error: "No readings provided" }, { status: 400 });
  }

  const readings: { payload: unknown; rssi: number | null; recordedAt: Date }[] = [];
  for (const r of rawReadings) {
    if (r.payload === undefined || r.payload === null || typeof r.payload !== "object") {
      return NextResponse.json({ error: "Each reading requires a payload object" }, { status: 400 });
    }
    let recordedAt = new Date();
    if (typeof r.ts === "string") {
      const parsed = new Date(r.ts);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: `Invalid ts: ${r.ts}` }, { status: 400 });
      }
      recordedAt = parsed;
    }
    const rssi = typeof r.rssi === "number" ? r.rssi : null;
    readings.push({ payload: r.payload, rssi: product.isCellular ? rssi : null, recordedAt });
  }

  // The device's cached "current status" should reflect whichever reading
  // is chronologically latest, not just the last element in the array.
  const latest = readings.reduce((a, b) => (b.recordedAt > a.recordedAt ? b : a));

  // A batch of buffered-while-offline readings can be OLDER than the
  // device's current cached status (e.g. it already posted live data, then
  // catches up on a backlog) — only advance the "current status" cache
  // forward in time, never let a stale batch regress it.
  const isNewestKnown = !device.lastReadingAt || latest.recordedAt > device.lastReadingAt;

  await prisma.$transaction([
    prisma.reading.createMany({
      data: readings.map((r) => ({
        deviceId: device.id,
        payload: r.payload as object,
        rssi: r.rssi,
        recordedAt: r.recordedAt,
      })),
    }),
    prisma.device.update({
      where: { id: device.id },
      data: {
        ...(isNewestKnown
          ? {
              lastPayload: latest.payload as object,
              lastReadingAt: latest.recordedAt,
              ...(product.isCellular ? { lastRssi: latest.rssi } : {}),
            }
          : {}),
        lastSeenAt: new Date(),
        ...(fw ? { fwVersion: fw } : {}),
        state: "active",
      },
    }),
  ]);

  const origin = new URL(request.url).origin;
  const ota = await checkPendingOta(device.id, origin);

  if (ota) {
    return NextResponse.json({ ota });
  }
  return new Response(null, { status: 204 });
}

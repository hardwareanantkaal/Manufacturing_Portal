import { getSession } from "@/lib/auth";
import { getDeviceByMac } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { isHistoryRange, resolveRange } from "@/lib/reading-history";

const BATCH_SIZE = 500;

export async function GET(request: Request, { params }: { params: Promise<{ mac: string }> }) {
  // Ownership is re-verified here rather than trusted from the page — this
  // route can be hit directly with any mac, so it must not rely on the page
  // having already checked tenant scoping.
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { mac } = await params;
  const device = await getDeviceByMac(session.clientId, mac);
  if (!device) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const rangeParam = url.searchParams.get("range") ?? undefined;
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const range = isHistoryRange(rangeParam) ? rangeParam : "24h";
  const { since, until } = resolveRange(range, from, to);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode("recordedAt,payload,rssi\n"));

      let skip = 0;
      while (true) {
        const rows = await prisma.reading.findMany({
          where: { deviceId: device.id, recordedAt: { gte: since, lte: until } },
          orderBy: { recordedAt: "asc" },
          skip,
          take: BATCH_SIZE,
        });
        if (rows.length === 0) break;

        for (const r of rows) {
          const payloadCsv = JSON.stringify(r.payload).replace(/"/g, '""');
          controller.enqueue(encoder.encode(`${r.recordedAt.toISOString()},"${payloadCsv}",${r.rssi ?? ""}\n`));
        }

        skip += rows.length;
        if (rows.length < BATCH_SIZE) break;
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${device.serial}-readings.csv"`,
    },
  });
}

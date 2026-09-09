import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mac = url.searchParams.get("mac");
  const version = url.searchParams.get("version");
  const rssi = url.searchParams.get("rssi");

  if (!mac) {
    return NextResponse.json({ error: "mac is required" }, { status: 400 });
  }

  const device = await prisma.device.findUnique({
    where: { mac: mac.toUpperCase() },
    include: { product: true },
  });
  if (!device) {
    return NextResponse.json({ error: "Unknown device" }, { status: 404 });
  }

  const parsedRssi = rssi ? parseInt(rssi, 10) : NaN;

  await prisma.device.update({
    where: { id: device.id },
    data: {
      lastSeenAt: new Date(),
      ...(version ? { fwVersion: version } : {}),
      ...(device.product.isCellular && !Number.isNaN(parsedRssi) ? { lastRssi: parsedRssi } : {}),
    },
  });

  const target = await prisma.otaTarget.findFirst({
    where: { deviceId: device.id, status: "pending" },
    include: { job: { include: { firmware: true } } },
    orderBy: { job: { createdAt: "asc" } },
  });

  if (!target) {
    return new Response(null, { status: 204 });
  }

  await prisma.otaTarget.update({
    where: { id: target.id },
    data: { status: "downloading", startedAt: new Date() },
  });

  return NextResponse.json({
    jobId: target.jobId,
    version: target.job.firmware.version,
    binUrl: new URL(target.job.firmware.binUrl, url.origin).toString(),
    sha256: target.job.firmware.sha256,
    sizeBytes: target.job.firmware.sizeBytes,
  });
}

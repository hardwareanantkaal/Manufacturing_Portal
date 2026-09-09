import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { mac, jobId, status, error } = body as {
    mac?: string;
    jobId?: string;
    status?: string;
    error?: string;
  };

  if (!mac || !jobId) {
    return NextResponse.json({ error: "mac and jobId are required" }, { status: 400 });
  }
  if (status !== "success" && status !== "failed") {
    return NextResponse.json({ error: 'status must be "success" or "failed"' }, { status: 400 });
  }

  const device = await prisma.device.findUnique({ where: { mac: mac.toUpperCase() } });
  if (!device) {
    return NextResponse.json({ error: "Unknown device" }, { status: 404 });
  }

  const target = await prisma.otaTarget.findUnique({
    where: { jobId_deviceId: { jobId, deviceId: device.id } },
    include: { job: { include: { firmware: true } } },
  });
  if (!target) {
    return NextResponse.json({ error: "No matching OTA target for this job/device" }, { status: 404 });
  }

  await prisma.device.update({
    where: { id: device.id },
    data: { lastSeenAt: new Date() },
  });

  if (status === "success") {
    await prisma.otaTarget.update({
      where: { id: target.id },
      data: { status: "success", completedAt: new Date() },
    });
    await prisma.device.update({
      where: { id: device.id },
      data: { fwVersion: target.job.firmware.version },
    });
  } else {
    await prisma.otaTarget.update({
      where: { id: target.id },
      data: {
        status: "failed",
        error: error ?? "Unknown error",
        retryCount: { increment: 1 },
        completedAt: new Date(),
      },
    });
  }

  const remaining = await prisma.otaTarget.count({
    where: { jobId, status: { in: ["pending", "downloading"] } },
  });
  if (remaining === 0) {
    await prisma.otaJob.update({
      where: { id: jobId },
      data: { status: "completed", completedAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}

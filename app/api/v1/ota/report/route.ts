import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_RETRIES = 3;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { targetId, ok, error, apiKey } = body as {
    targetId?: string;
    ok?: boolean;
    error?: string;
    apiKey?: string;
  };

  if (!targetId || typeof ok !== "boolean") {
    return NextResponse.json({ error: "targetId and ok are required" }, { status: 400 });
  }

  const target = await prisma.otaTarget.findUnique({
    where: { id: targetId },
    include: { device: { include: { product: true } }, job: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Unknown target" }, { status: 404 });
  }

  if (apiKey !== target.device.product.apiKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  if (ok) {
    await prisma.otaTarget.update({
      where: { id: target.id },
      data: { status: "success", completedAt: new Date() },
    });
  } else {
    const retryCount = target.retryCount + 1;
    // Under 3 attempts: requeue as "pending" so the next poll serves it
    // again. At 3, fail permanently — a device endlessly retrying a
    // download on a metered SIM is an expensive bug in itself.
    const permanentlyFailed = retryCount >= MAX_RETRIES;
    await prisma.otaTarget.update({
      where: { id: target.id },
      data: {
        status: permanentlyFailed ? "failed" : "pending",
        error: error ?? "Unknown error",
        retryCount,
        completedAt: permanentlyFailed ? new Date() : null,
      },
    });
  }

  const remaining = await prisma.otaTarget.count({
    where: { jobId: target.jobId, status: { in: ["pending", "downloading"] } },
  });
  if (remaining === 0) {
    await prisma.otaJob.update({
      where: { id: target.jobId },
      data: { status: "completed", completedAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}

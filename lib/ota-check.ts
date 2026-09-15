import { prisma } from "@/lib/prisma";

// Shared with /api/v1/ota/report so a target that fails via either path
// (an explicit report, or the stale-download recovery below) retries and
// gives up at the same point.
export const MAX_OTA_RETRIES = 3;

// Call after changing any target's status — if nothing on the job is left
// pending/downloading, the job itself is done. Both the explicit report
// route and the stale-download recovery below can be what tips a job over
// to "no targets left," so this can't only live in one of them.
export async function finalizeJobIfComplete(jobId: string) {
  const remaining = await prisma.otaTarget.count({
    where: { jobId, status: { in: ["pending", "downloading"] } },
  });
  if (remaining === 0) {
    await prisma.otaJob.update({
      where: { id: jobId },
      data: { status: "completed", completedAt: new Date() },
    });
  }
}

// A device can crash or lose power mid-download (e.g. a watchdog reset
// during a slow flash write) without ever calling /api/v1/ota/report. Left
// alone, that target sits at "downloading" forever — checkPendingOta below
// only looks for status "pending", so it would never be offered again, and
// the job would never show as anything but "running" even though nothing
// is actually happening. Recover anything that's been "downloading" for
// too long the same way an explicit failure report would: requeue under
// the retry cap, or fail permanently once it's exhausted.
const STALE_DOWNLOAD_MS = 3 * 60 * 1000;

async function recoverStaleDownload(deviceId: string) {
  const stale = await prisma.otaTarget.findFirst({
    where: {
      deviceId,
      status: "downloading",
      startedAt: { lt: new Date(Date.now() - STALE_DOWNLOAD_MS) },
    },
  });
  if (!stale) return;

  const retryCount = stale.retryCount + 1;
  const permanentlyFailed = retryCount >= MAX_OTA_RETRIES;
  await prisma.otaTarget.update({
    where: { id: stale.id },
    data: {
      status: permanentlyFailed ? "failed" : "pending",
      error: "Device went silent mid-download (likely crashed or reset) without reporting",
      retryCount,
      completedAt: permanentlyFailed ? new Date() : null,
      startedAt: null,
    },
  });
  await finalizeJobIfComplete(stale.jobId);
}

// Shared by the data-ingest endpoint's piggybacked OTA check and the
// standalone /api/v1/ota/[productKey] poll — both must serve (and
// transition) a pending target the exact same way, or a device that uses
// one path and not the other would behave differently.
export async function checkPendingOta(deviceId: string, origin: string) {
  await recoverStaleDownload(deviceId);

  const target = await prisma.otaTarget.findFirst({
    where: { deviceId, status: "pending" },
    include: { job: { include: { firmware: true } } },
    orderBy: { job: { createdAt: "asc" } },
  });

  if (!target) return null;

  await prisma.otaTarget.update({
    where: { id: target.id },
    data: { status: "downloading", startedAt: new Date() },
  });

  return {
    version: target.job.firmware.version,
    url: new URL(`/api/v1/firmware/${target.job.firmware.id}`, origin).toString(),
    sha256: target.job.firmware.sha256,
    size: target.job.firmware.sizeBytes,
    targetId: target.id,
  };
}

import { prisma } from "@/lib/prisma";

// Shared by the data-ingest endpoint's piggybacked OTA check and the
// standalone /api/v1/ota/[productKey] poll — both must serve (and
// transition) a pending target the exact same way, or a device that uses
// one path and not the other would behave differently.
export async function checkPendingOta(deviceId: string, origin: string) {
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

"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createOtaJob({
  firmwareId,
  deviceIds,
}: {
  firmwareId: string;
  deviceIds: string[];
}) {
  if (!firmwareId) return { error: "Select a firmware version." };
  if (deviceIds.length === 0) return { error: "Select at least one target device." };

  const session = await getSession();

  // The session cookie is a signed token, not a live DB lookup — it stays
  // "valid" (right signature, not expired) even if the admin row it points
  // to was deleted or replaced (e.g. after a DB reset). createdById is a
  // real foreign key, so that combination crashes here instead of at login.
  // Catch it early with a clear message instead of a raw FK-violation error.
  const adminExists = session?.adminId
    ? await prisma.admin.findUnique({ where: { id: session.adminId }, select: { id: true } })
    : null;
  if (session?.adminId && !adminExists) {
    return { error: "Your session is out of date — please log out and log back in, then try again." };
  }

  await prisma.$transaction(async (tx) => {
    const job = await tx.otaJob.create({
      data: { firmwareId, createdById: adminExists?.id },
    });
    await tx.otaTarget.createMany({
      data: deviceIds.map((deviceId) => ({ jobId: job.id, deviceId })),
    });
  });

  revalidatePath("/ota");
  return { error: null };
}

// Delivery is pull-based (a device only learns about a pending target when
// it next polls), so there's no way to reach out and stop a device that's
// already mid-download — it'll finish and report success/failure regardless.
// What cancel CAN do: stop any target still "pending" (not yet handed to a
// device) from ever being served — checkPendingOta() only looks at
// status: "pending", so flipping those to "cancelled" here is what actually
// takes effect, not just marking the job itself.
export async function cancelOtaJob(jobId: string) {
  const job = await prisma.otaJob.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job) return { error: "Job not found." };
  if (job.status !== "running") return { error: "Only a running job can be cancelled." };

  await prisma.$transaction([
    prisma.otaTarget.updateMany({
      where: { jobId, status: "pending" },
      data: { status: "cancelled", completedAt: new Date() },
    }),
    prisma.otaJob.update({
      where: { id: jobId },
      data: { status: "cancelled", completedAt: new Date() },
    }),
  ]);

  revalidatePath("/ota");
  revalidatePath(`/ota/${jobId}`);
  return { error: null };
}

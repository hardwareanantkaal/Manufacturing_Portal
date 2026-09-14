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

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

  await prisma.$transaction(async (tx) => {
    const job = await tx.otaJob.create({
      data: { firmwareId, createdById: session?.adminId },
    });
    await tx.otaTarget.createMany({
      data: deviceIds.map((deviceId) => ({ jobId: job.id, deviceId })),
    });
  });

  revalidatePath("/ota");
  return { error: null };
}

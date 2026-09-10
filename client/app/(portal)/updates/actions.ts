"use server";

import { requireClient, createClientOtaJob } from "@/lib/tenant";
import { revalidatePath } from "next/cache";

export async function triggerOtaJob(params: { firmwareId: string; deviceIds: string[] }) {
  const { clientId, role } = await requireClient();
  const result = await createClientOtaJob(clientId, role, params);
  if (!result.error) revalidatePath("/updates");
  return result;
}

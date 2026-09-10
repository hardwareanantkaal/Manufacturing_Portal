"use server";

import { requireClient, claimDevice } from "@/lib/tenant";
import { redirect } from "next/navigation";

export async function confirmClaimAction(_prevState: string | null, formData: FormData) {
  const { clientId } = await requireClient();
  const mac = formData.get("mac") as string;
  const token = formData.get("token") as string;

  const claimed = await claimDevice(clientId, mac, token);
  if (!claimed) {
    return "This device can no longer be claimed — it may have already been claimed, or the link is no longer valid. Refresh and check its status from your devices list.";
  }

  redirect(`/devices/${mac}`);
}

"use server";

import { prisma } from "@/lib/prisma";
import { nextSerial } from "@/lib/serial";
import { generateClaimToken } from "@/lib/claim-token";
import { revalidatePath } from "next/cache";

export async function createDevice(formData: FormData) {
  const productId = formData.get("productId") as string;
  const serial = await nextSerial(productId);

  await prisma.device.create({
    data: {
      serial,
      mac: (formData.get("mac") as string).toUpperCase(),
      claimToken: generateClaimToken(),
      productId,
      imei: (formData.get("imei") as string) || null,
      iccid: (formData.get("iccid") as string) || null,
    },
  });
  revalidatePath("/devices");
}

export async function deleteDevice(id: string) {
  await prisma.device.delete({ where: { id } });
  revalidatePath("/devices");
}

const SERIAL_REGEX = /^\d{6}$/;

export async function updateDeviceSerial(_prevState: string | null, formData: FormData) {
  const deviceId = formData.get("deviceId") as string;
  const serial = formData.get("serial") as string;

  if (!SERIAL_REGEX.test(serial)) {
    return "Serial must be exactly 6 digits.";
  }

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) return "Device not found.";

  const clash = await prisma.device.findUnique({
    where: { productId_serial: { productId: device.productId, serial } },
  });
  if (clash && clash.id !== deviceId) {
    return `Serial ${serial} is already used by another device on this product.`;
  }

  await prisma.device.update({ where: { id: deviceId }, data: { serial } });
  revalidatePath("/devices");
  revalidatePath(`/devices/${device.mac}`);
  return null;
}

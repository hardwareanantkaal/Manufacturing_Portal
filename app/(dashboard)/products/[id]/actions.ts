"use server";

import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/product-key";
import { revalidatePath } from "next/cache";

type SensorField = { key: string; label: string; unit: string };

export async function updateProductSettings(_prevState: string | null, formData: FormData) {
  const productId = formData.get("productId") as string;
  const productKey = (formData.get("productKey") as string)?.trim();
  const readIntervalRaw = formData.get("readInterval") as string;
  const sensorSchemaRaw = formData.get("sensorSchema") as string;

  if (!productKey || !/^[a-z0-9-]+$/.test(productKey)) {
    return "Product key must contain only lowercase letters, numbers, and dashes.";
  }

  const readInterval = parseInt(readIntervalRaw, 10);
  if (Number.isNaN(readInterval) || readInterval < 1) {
    return "Read interval must be a positive number of seconds.";
  }

  let sensorSchema: SensorField[];
  try {
    sensorSchema = JSON.parse(sensorSchemaRaw);
  } catch {
    return "Sensor schema was malformed. Try again.";
  }
  for (const field of sensorSchema) {
    if (!field.key || !field.key.trim()) {
      return "Every sensor field needs a key.";
    }
  }

  const existing = await prisma.product.findUnique({ where: { productKey } });
  if (existing && existing.id !== productId) {
    return `Product key "${productKey}" is already used by another product.`;
  }

  await prisma.product.update({
    where: { id: productId },
    data: { productKey, readInterval, sensorSchema },
  });

  revalidatePath(`/products/${productId}`);
  return null;
}

export async function regenerateApiKey(productId: string) {
  await prisma.product.update({
    where: { id: productId },
    data: { apiKey: generateApiKey() },
  });
  revalidatePath(`/products/${productId}`);
}

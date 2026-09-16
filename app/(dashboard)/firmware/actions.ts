"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { put, del } from "@vercel/blob";

// version becomes part of a filesystem path, so restrict it to safe characters
// (no "/", "..", etc.) — otherwise a crafted version string could write outside
// the firmware directory.
const VERSION_REGEX = /^[a-zA-Z0-9._-]+$/;

export async function uploadFirmware(_prevState: string | null, formData: FormData) {
  const productId = formData.get("productId") as string;
  const version = formData.get("version") as string;
  const notes = (formData.get("notes") as string) || null;
  const file = formData.get("file") as File | null;

  if (!productId) return "Select a product.";
  if (!version || !VERSION_REGEX.test(version)) {
    return "Version must contain only letters, numbers, dots, dashes and underscores.";
  }
  if (!file || file.size === 0) return "Choose a .bin file.";
  if (!file.name.toLowerCase().endsWith(".bin")) return "File must be a .bin firmware image.";

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return "Product not found.";

  const existing = await prisma.firmware.findUnique({
    where: { productId_version: { productId, version } },
  });
  if (existing) return `${product.name} already has a firmware version ${version}.`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

  // "private" — devices/admins only ever reach this file through our own
  // apiKey-gated download route (app/api/v1/firmware/[firmwareId]), never
  // by knowing the Blob URL directly. No random suffix: the path is already
  // unique (enforced by the productId_version DB constraint above), and a
  // deterministic path makes the stored binUrl legible.
  const blob = await put(`firmware/${productId}/${version}.bin`, buffer, {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/octet-stream",
  });

  await prisma.firmware.create({
    data: {
      productId,
      version,
      binUrl: blob.url,
      sha256,
      sizeBytes: buffer.byteLength,
      notes,
    },
  });

  revalidatePath("/firmware");
  return null;
}

export async function deleteFirmware(id: string) {
  const firmware = await prisma.firmware.findUnique({ where: { id } });
  if (firmware) {
    // Best-effort — if the blob's already gone for some reason, don't let
    // that block removing the DB row.
    await del(firmware.binUrl).catch(() => {});
  }
  await prisma.firmware.delete({ where: { id } });
  revalidatePath("/firmware");
}

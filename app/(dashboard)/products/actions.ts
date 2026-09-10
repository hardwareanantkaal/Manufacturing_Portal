"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { slugify, generateApiKey } from "@/lib/product-key";
import crypto from "crypto";

export async function createProduct(formData: FormData) {
  const isCellular = formData.get("isCellular") === "on";
  const name = formData.get("name") as string;

  let productKey = slugify(name);
  const existing = await prisma.product.findUnique({ where: { productKey } });
  if (existing) {
    productKey = `${productKey}-${crypto.randomUUID().slice(0, 4)}`;
  }

  await prisma.product.create({
    data: {
      name,
      clientId: formData.get("clientId") as string,
      chipFamily: formData.get("chipFamily") as string,
      isCellular,
      modemModel: isCellular ? (formData.get("modemModel") as string) || null : null,
      productKey,
      apiKey: generateApiKey(),
    },
  });
  revalidatePath("/products");
}

export async function deleteProduct(id: string) {
  await prisma.product.delete({ where: { id } });
  revalidatePath("/products");
}

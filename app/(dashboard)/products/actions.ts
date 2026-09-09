"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createProduct(formData: FormData) {
  const isCellular = formData.get("isCellular") === "on";

  await prisma.product.create({
    data: {
      name: formData.get("name") as string,
      clientId: formData.get("clientId") as string,
      chipFamily: formData.get("chipFamily") as string,
      isCellular,
      modemModel: isCellular ? (formData.get("modemModel") as string) || null : null,
    },
  });
  revalidatePath("/products");
}

export async function deleteProduct(id: string) {
  await prisma.product.delete({ where: { id } });
  revalidatePath("/products");
}

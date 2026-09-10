"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createClient(formData: FormData) {
  await prisma.client.create({
    data: {
      name: formData.get("name") as string,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
    },
  });
  revalidatePath("/clients");
}

export async function deleteClient(id: string) {
  await prisma.client.delete({ where: { id } });
  revalidatePath("/clients");
}

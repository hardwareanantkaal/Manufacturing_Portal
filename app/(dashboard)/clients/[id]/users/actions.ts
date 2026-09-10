"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

export async function createClientUser(_prevState: string | null, formData: FormData) {
  const clientId = formData.get("clientId") as string;
  const email = formData.get("email") as string;
  const name = (formData.get("name") as string) || null;
  const role = formData.get("role") as string;
  const password = formData.get("password") as string;

  if (!password || password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await prisma.clientUser.create({
      data: { email, name, role, passwordHash, clientId },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return `A user with email ${email} already exists.`;
    }
    throw err;
  }

  revalidatePath(`/clients/${clientId}/users`);
  return null;
}

export async function setUserActive(userId: string, clientId: string, isActive: boolean) {
  await prisma.clientUser.update({ where: { id: userId }, data: { isActive } });
  revalidatePath(`/clients/${clientId}/users`);
}

export async function resetUserPassword(_prevState: string | null, formData: FormData) {
  const userId = formData.get("userId") as string;
  const clientId = formData.get("clientId") as string;
  const password = formData.get("password") as string;

  if (!password || password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.clientUser.update({ where: { id: userId }, data: { passwordHash } });
  revalidatePath(`/clients/${clientId}/users`);
  return null;
}

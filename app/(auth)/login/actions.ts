"use server";

import { login } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function loginAction(_prevState: string | null, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const admin = await login(email, password);
  if (!admin) return "Invalid email or password.";

  redirect("/dashboard");
}

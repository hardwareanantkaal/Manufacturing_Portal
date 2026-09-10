"use server";

import { login } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function loginAction(_prevState: string | null, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const next = (formData.get("next") as string) || "/dashboard";

  const user = await login(email, password);
  if (!user) return "Invalid email or password.";

  // only ever redirect within this app — never follow an absolute/external URL
  redirect(next.startsWith("/") ? next : "/dashboard");
}

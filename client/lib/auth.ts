import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import {
  encodeSession,
  verifySessionCookie,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  type SessionPayload,
} from "@/lib/session";

export type { SessionPayload };

export async function login(email: string, password: string) {
  const user = await prisma.clientUser.findUnique({ where: { email } });
  if (!user) return null;
  if (!user.isActive) return null; // deactivated accounts can't sign in even with the right password

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  await prisma.clientUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createSession(user);
  return user;
}

export async function createSession(user: { id: string; clientId: string; role: string }) {
  const payload: SessionPayload = {
    userId: user.id,
    clientId: user.clientId,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await encodeSession(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return verifySessionCookie(raw);
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

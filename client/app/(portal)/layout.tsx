import { Sidebar } from "@/components/sidebar";
import { requireClient } from "@/lib/tenant";
import { logout } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { clientId, userId } = await requireClient();

  const [client, user] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId } }),
    prisma.clientUser.findUnique({ where: { id: userId } }),
  ]);

  // the session pointed at a client/user that no longer exists (deleted,
  // deactivated in a way that removed the row) — do not render with stale data
  if (!client || !user) redirect("/login");

  async function logoutAction() {
    "use server";
    await logout();
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        clientName={client.name}
        userName={user.name ?? user.email}
        logoutAction={logoutAction}
      />
      <main className="flex-1 bg-background">{children}</main>
    </div>
  );
}

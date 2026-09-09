import { Sidebar } from "@/components/sidebar";
import { getSession, logout } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  async function logoutAction() {
    "use server";
    await logout();
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar adminName={session.name ?? session.email} logoutAction={logoutAction} />
      <main className="flex-1 bg-background">{children}</main>
    </div>
  );
}
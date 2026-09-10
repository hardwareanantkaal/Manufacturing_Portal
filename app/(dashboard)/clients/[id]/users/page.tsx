import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CreateUserForm } from "./create-user-form";
import { ResetPasswordForm } from "./reset-password-form";
import { setUserActive } from "./actions";
import { RoleSelector } from "./role-selector";
import { ArrowLeft } from "lucide-react";

export default async function ClientUsersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: { users: { orderBy: { createdAt: "desc" } } },
  });

  if (!client) notFound();

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href={`/clients/${client.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft size={14} />
          {client.name}
        </Link>
        <h1 className="text-xl font-semibold text-foreground">Portal Users</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Client portal logins for {client.name}. Accounts are created by staff only — there is
          no self-registration.
        </p>
      </div>

      <CreateUserForm clientId={client.id} />

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="h-9 px-3 text-left font-semibold">Email</th>
              <th className="h-9 px-3 text-left font-semibold">Name</th>
              <th className="h-9 px-3 text-left font-semibold">Role</th>
              <th className="h-9 px-3 text-left font-semibold">Status</th>
              <th className="h-9 px-3 text-left font-semibold">Last Login</th>
              <th className="h-9 px-3 text-left font-semibold"></th>
              <th className="h-9 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {client.users.map((u) => (
              <tr key={u.id} className="border-t border-border hover:bg-slate-50/70 transition-colors">
                <td className="px-3 py-2.5 font-medium text-foreground">{u.email}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{u.name ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <RoleSelector userId={u.id} clientId={client.id} currentRole={u.role} />
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`px-2 py-0.5 rounded-md font-mono text-xs font-semibold ${
                      u.isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {u.isActive ? "active" : "deactivated"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {u.lastLoginAt ? u.lastLoginAt.toLocaleString() : "never"}
                </td>
                <td className="px-3 py-2.5">
                  <ResetPasswordForm userId={u.id} clientId={client.id} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <form action={setUserActive.bind(null, u.id, client.id, !u.isActive)}>
                    <button
                      className={`text-xs font-medium transition-colors ${
                        u.isActive
                          ? "text-rose-600 hover:text-rose-700"
                          : "text-emerald-600 hover:text-emerald-700"
                      }`}
                    >
                      {u.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {client.users.length === 0 && (
          <p className="text-sm text-muted-foreground p-6 text-center">No portal users yet.</p>
        )}
      </div>
    </div>
  );
}

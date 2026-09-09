import { prisma } from "@/lib/prisma";
import { createClient, deleteClient } from "./actions";
import { Building2 } from "lucide-react";
import Link from "next/link";

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Clients</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage client accounts and their assigned products.
        </p>
      </div>

      <form
        action={createClient}
        className="flex flex-wrap items-end gap-2 mb-6 p-3 rounded-lg border border-border bg-card"
      >
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Company name
          </label>
          <input
            name="name"
            placeholder="Acme Robotics"
            required
            className="h-8 w-56 rounded-md border border-input bg-white px-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Email
          </label>
          <input
            name="email"
            placeholder="ops@client.com"
            className="h-8 w-56 rounded-md border border-input bg-white px-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Phone
          </label>
          <input
            name="phone"
            placeholder="+91 98765 43210"
            className="h-8 w-44 rounded-md border border-input bg-white px-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <button
          type="submit"
          className="h-8 px-3.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Add Client
        </button>
      </form>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="h-9 px-3 text-left font-semibold">Name</th>
              <th className="h-9 px-3 text-left font-semibold">Email</th>
              <th className="h-9 px-3 text-left font-semibold">Phone</th>
              <th className="h-9 px-3 text-left font-semibold">Products</th>
              <th className="h-9 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c: (typeof clients)[number]) => (
              <tr
                key={c.id}
                className="border-t border-border hover:bg-slate-50/70 transition-colors"
              >
                <td className="px-3 py-2.5">
                  <Link
                    href={`/clients/${c.id}`}
                    className="flex items-center gap-2 font-medium text-foreground hover:text-primary transition-colors"
                  >
                    <span className="flex items-center justify-center w-7 h-7 rounded-md bg-secondary text-secondary-foreground shrink-0">
                      <Building2 size={14} />
                    </span>
                    {c.name}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{c.email ?? "—"}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                  {c.phone ?? "—"}
                </td>
                <td className="px-3 py-2.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-semibold">
                    {c._count.products}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <form action={deleteClient.bind(null, c.id)}>
                    <button className="text-xs font-medium text-rose-600 hover:text-rose-700 transition-colors">
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {clients.length === 0 && (
          <p className="text-sm text-muted-foreground p-6 text-center">No clients yet.</p>
        )}
      </div>
    </div>
  );
}
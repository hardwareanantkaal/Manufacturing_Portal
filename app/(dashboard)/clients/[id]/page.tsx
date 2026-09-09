import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Cpu, Wifi, Signal } from "lucide-react";

const LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={LABEL_CLASS}>{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      products: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { devices: true, firmwares: true } } },
      },
    },
  });

  if (!client) notFound();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">{client.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Client since {client.createdAt.toLocaleDateString()}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 mb-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="Email" value={client.email ?? "—"} />
          <Field label="Phone" value={<span className="font-mono">{client.phone ?? "—"}</span>} />
          <Field label="Address" value={client.address ?? "—"} />
          <Field label="Products" value={client.products.length} />
        </div>
        {client.notes && (
          <div className="mt-4 pt-4 border-t border-border">
            <Field label="Notes" value={client.notes} />
          </div>
        )}
      </div>

      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">Products</h2>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="h-9 px-3 text-left font-semibold">Name</th>
                <th className="h-9 px-3 text-left font-semibold">Chip Family</th>
                <th className="h-9 px-3 text-left font-semibold">Network</th>
                <th className="h-9 px-3 text-left font-semibold">Devices</th>
                <th className="h-9 px-3 text-left font-semibold">Firmwares</th>
              </tr>
            </thead>
            <tbody>
              {client.products.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/products/${p.id}`}
                      className="flex items-center gap-2 font-medium text-foreground hover:text-primary transition-colors"
                    >
                      <span className="flex items-center justify-center w-7 h-7 rounded-md bg-secondary text-secondary-foreground shrink-0">
                        <Cpu size={14} />
                      </span>
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-foreground">{p.chipFamily}</td>
                  <td className="px-3 py-2.5">
                    {p.isCellular ? (
                      <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-[11px] font-semibold">
                        <Signal size={11} />
                        {p.modemModel ?? "Cellular"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded-full border bg-slate-100 text-slate-600 border-slate-200 font-mono text-[11px] font-semibold">
                        <Wifi size={11} />
                        WiFi
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-semibold">
                      {p._count.devices}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-semibold">
                      {p._count.firmwares}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {client.products.length === 0 && (
            <p className="text-sm text-muted-foreground p-6 text-center">No products yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

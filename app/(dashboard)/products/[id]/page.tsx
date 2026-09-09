import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Wifi, Signal } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      client: true,
      devices: { orderBy: { flashedAt: "desc" } },
      firmwares: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!product) notFound();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">{product.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">{product.client.name}</p>
        <div className="flex gap-2 mt-3">
          <span className="inline-flex items-center h-5 px-2 rounded-full border bg-slate-100 text-slate-600 border-slate-200 font-mono text-[11px] font-semibold">
            {product.chipFamily}
          </span>
          {product.isCellular ? (
            <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-[11px] font-semibold">
              <Signal size={11} />
              {product.modemModel ?? "Cellular"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded-full border bg-slate-100 text-slate-600 border-slate-200 font-mono text-[11px] font-semibold">
              <Wifi size={11} />
              WiFi
            </span>
          )}
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-foreground mb-3">Devices</h2>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="h-9 px-3 text-left font-semibold">Serial</th>
                <th className="h-9 px-3 text-left font-semibold">MAC</th>
                <th className="h-9 px-3 text-left font-semibold">State</th>
                <th className="h-9 px-3 text-left font-semibold">Firmware</th>
              </tr>
            </thead>
            <tbody>
              {product.devices.map((d: (typeof product.devices)[number]) => (
                <tr key={d.id} className="border-t border-border hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs text-foreground">{d.serial}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-foreground">{d.mac}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={d.state} />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                    {d.fwVersion ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {product.devices.length === 0 && (
            <p className="text-sm text-muted-foreground p-6 text-center">No devices yet.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">Firmware</h2>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="h-9 px-3 text-left font-semibold">Version</th>
                <th className="h-9 px-3 text-left font-semibold">Channel</th>
                <th className="h-9 px-3 text-left font-semibold">Size</th>
                <th className="h-9 px-3 text-left font-semibold">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {product.firmwares.map((f: (typeof product.firmwares)[number]) => (
                <tr key={f.id} className="border-t border-border hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs font-semibold text-foreground">{f.version}</td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-semibold">
                      {f.channel}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                    {(f.sizeBytes / 1024 / 1024).toFixed(2)} MB
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{f.createdAt.toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {product.firmwares.length === 0 && (
            <p className="text-sm text-muted-foreground p-6 text-center">No firmware uploaded yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

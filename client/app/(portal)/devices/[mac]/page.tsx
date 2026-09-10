import { requireClient, getDeviceByMac } from "@/lib/tenant";
import { notFound } from "next/navigation";
import { Antenna } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";

const LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={LABEL_CLASS}>{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export default async function DeviceDetailPage({
  params,
}: {
  params: Promise<{ mac: string }>;
}) {
  const { clientId } = await requireClient();
  const { mac } = await params;

  const device = await getDeviceByMac(clientId, mac);
  if (!device) notFound();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-mono text-xl font-semibold text-foreground">{device.serial}</h1>
        <p className="text-sm text-muted-foreground mt-1">{device.product.name}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Device Info</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label="Serial" value={<span className="font-mono">{device.serial}</span>} />
            <Field label="Product" value={device.product.name} />
            <Field label="State" value={<StatusBadge status={device.state} />} />
            <Field label="Firmware" value={<span className="font-mono">{device.fwVersion ?? "—"}</span>} />
            <Field
              label="Last Seen"
              value={device.lastSeenAt ? device.lastSeenAt.toLocaleString() : "never"}
            />
          </div>
        </div>

        {device.product.isCellular && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-1.5">
              <Antenna size={14} className="text-emerald-600" />
              Cellular
            </h2>
            <div className="flex flex-col gap-4">
              <Field label="Operator" value={device.operator ?? "—"} />
              <Field
                label="Signal"
                value={<span className="font-mono">{device.lastRssi != null ? `${device.lastRssi} dBm` : "—"}</span>}
              />
            </div>
          </div>
        )}
      </div>

      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">OTA History</h2>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="h-9 px-3 text-left font-semibold">Version</th>
                <th className="h-9 px-3 text-left font-semibold">Status</th>
                <th className="h-9 px-3 text-left font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody>
              {device.otaTargets.map((t) => (
                <tr key={t.id} className="border-t border-border hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs font-semibold text-foreground">
                    {t.job.firmware.version}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{t.updatedAt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {device.otaTargets.length === 0 && (
            <p className="text-sm text-muted-foreground p-6 text-center">No OTA history yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

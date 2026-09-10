import { requireClient, getDashboardStats, getRecentOtaActivity } from "@/lib/tenant";
import { CircuitBoard, Wifi, Cpu, RefreshCw } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ size?: number }>;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-2xl font-semibold text-foreground mt-1">{value}</p>
      </div>
      <span className="flex items-center justify-center w-9 h-9 rounded-md bg-secondary text-secondary-foreground">
        <Icon size={18} />
      </span>
    </div>
  );
}

export default async function DashboardPage() {
  const { clientId } = await requireClient();

  const [stats, recentActivity] = await Promise.all([
    getDashboardStats(clientId),
    getRecentOtaActivity(clientId, 10),
  ]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your devices and recent firmware activity.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatTile label="Total Devices" value={stats.totalDevices} icon={CircuitBoard} />
        <StatTile label="Online" value={stats.onlineDevices} icon={Wifi} />
        <StatTile label="Need Update" value={stats.needsUpdateCount} icon={RefreshCw} />
        <StatTile label="Products" value={stats.productCount} icon={Cpu} />
      </div>

      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">Recent OTA Activity</h2>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="h-9 px-3 text-left font-semibold">Device</th>
                <th className="h-9 px-3 text-left font-semibold">Version</th>
                <th className="h-9 px-3 text-left font-semibold">Status</th>
                <th className="h-9 px-3 text-left font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((t) => (
                <tr key={t.id} className="border-t border-border hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs text-foreground">{t.device.serial}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                    {t.job.firmware.version}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {t.updatedAt.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentActivity.length === 0 && (
            <p className="text-sm text-muted-foreground p-6 text-center">No OTA activity yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

import { requireClient, getProductsWithFirmware, getDevices, getOtaJobsForClient } from "@/lib/tenant";
import { UpdatePanel } from "./update-panel";
import { StatusBadge } from "@/components/status-badge";

export default async function UpdatesPage() {
  const { clientId, role } = await requireClient();

  const [products, devices, jobs] = await Promise.all([
    getProductsWithFirmware(clientId),
    getDevices(clientId),
    getOtaJobsForClient(clientId),
  ]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Firmware Updates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Push firmware to your devices and track rollout status.
        </p>
      </div>

      <UpdatePanel
        products={products}
        devices={devices.map((d) => ({
          id: d.id,
          serial: d.serial,
          state: d.state,
          fwVersion: d.fwVersion,
          productId: d.productId,
        }))}
        canTrigger={role === "admin"}
      />

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="h-9 px-3 text-left font-semibold">Firmware</th>
              <th className="h-9 px-3 text-left font-semibold">Targets</th>
              <th className="h-9 px-3 text-left font-semibold w-64">Progress</th>
              <th className="h-9 px-3 text-left font-semibold">Status</th>
              <th className="h-9 px-3 text-left font-semibold">Started</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const total = job.targets.length;
              const success = job.targets.filter((t) => t.status === "success").length;
              const failed = job.targets.filter((t) => t.status === "failed").length;
              const pending = total - success - failed;
              const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);

              return (
                <tr key={job.id} className="border-t border-border hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {job.firmware.version}
                    </span>
                    <span className="ml-2 text-muted-foreground">{job.firmware.product.name}</span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-foreground">{total}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 w-full">
                      <div className="bg-emerald-500" style={{ width: `${pct(success)}%` }} />
                      <div className="bg-rose-500" style={{ width: `${pct(failed)}%` }} />
                      <div className="bg-amber-400" style={{ width: `${pct(pending)}%` }} />
                    </div>
                    <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground font-mono">
                      <span className="text-emerald-700">{success} ok</span>
                      <span className="text-rose-700">{failed} failed</span>
                      <span className="text-amber-700">{pending} pending</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {job.createdAt.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {jobs.length === 0 && (
          <p className="text-sm text-muted-foreground p-6 text-center">No update jobs yet.</p>
        )}
      </div>
    </div>
  );
}

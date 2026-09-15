import { prisma } from "@/lib/prisma";
import { CreateJobPanel } from "./create-job-panel";
import { CancelJobButton } from "./cancel-job-button";
import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";

export default async function OtaPage() {
  const [products, devices, jobs] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        isCellular: true,
        firmwares: {
          orderBy: { createdAt: "desc" },
          select: { id: true, version: true, channel: true, sizeBytes: true },
        },
      },
    }),
    prisma.device.findMany({
      select: { id: true, serial: true, mac: true, state: true, productId: true },
    }),
    prisma.otaJob.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        firmware: { include: { product: true } },
        targets: { select: { status: true } },
      },
    }),
  ]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">OTA Updates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Roll out firmware to devices in bulk and track delivery per device.
        </p>
      </div>

      <CreateJobPanel products={products} devices={devices} />

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="h-9 px-3 text-left font-semibold">Firmware</th>
              <th className="h-9 px-3 text-left font-semibold">Targets</th>
              <th className="h-9 px-3 text-left font-semibold w-64">Progress</th>
              <th className="h-9 px-3 text-left font-semibold">Status</th>
              <th className="h-9 px-3 text-left font-semibold">Started</th>
              <th className="h-9 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const total = job.targets.length;
              const success = job.targets.filter((t) => t.status === "success").length;
              const failed = job.targets.filter((t) => t.status === "failed").length;
              const cancelled = job.targets.filter((t) => t.status === "cancelled").length;
              const pending = total - success - failed - cancelled;
              const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);

              return (
                <tr key={job.id} className="border-t border-border hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2.5">
                    <Link href={`/ota/${job.id}`} className="hover:text-primary transition-colors">
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {job.firmware.version}
                      </span>
                      <span className="ml-2 text-muted-foreground">{job.firmware.product.name}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-foreground">{total}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 w-full">
                      <div className="bg-emerald-500" style={{ width: `${pct(success)}%` }} />
                      <div className="bg-rose-500" style={{ width: `${pct(failed)}%` }} />
                      <div className="bg-slate-400" style={{ width: `${pct(cancelled)}%` }} />
                      <div className="bg-amber-400" style={{ width: `${pct(pending)}%` }} />
                    </div>
                    <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground font-mono">
                      <span className="text-emerald-700">{success} ok</span>
                      <span className="text-rose-700">{failed} failed</span>
                      {cancelled > 0 && <span className="text-slate-500">{cancelled} cancelled</span>}
                      <span className="text-amber-700">{pending} pending</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {job.createdAt.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {job.status === "running" && <CancelJobButton jobId={job.id} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {jobs.length === 0 && (
          <p className="text-sm text-muted-foreground p-6 text-center">No OTA jobs yet.</p>
        )}
      </div>
    </div>
  );
}

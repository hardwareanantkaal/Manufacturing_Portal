import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
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

export default async function OtaJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const job = await prisma.otaJob.findUnique({
    where: { id },
    include: {
      firmware: { include: { product: { include: { client: true } } } },
      createdBy: true,
      targets: {
        orderBy: { updatedAt: "desc" },
        include: { device: true },
      },
    },
  });

  if (!job) notFound();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground font-mono">{job.firmware.version}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {job.firmware.product.name} &middot; {job.firmware.product.client.name}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 mb-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="Status" value={<StatusBadge status={job.status} />} />
          <Field label="Targets" value={job.targets.length} />
          <Field label="Created" value={job.createdAt.toLocaleString()} />
          <Field label="Completed" value={job.completedAt ? job.completedAt.toLocaleString() : "—"} />
        </div>
        {job.createdBy && (
          <div className="mt-4 pt-4 border-t border-border">
            <Field label="Created by" value={job.createdBy.name ?? job.createdBy.email} />
          </div>
        )}
      </div>

      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">Targets</h2>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="h-9 px-3 text-left font-semibold">Serial</th>
                <th className="h-9 px-3 text-left font-semibold">MAC</th>
                <th className="h-9 px-3 text-left font-semibold">Status</th>
                <th className="h-9 px-3 text-left font-semibold">Error</th>
                <th className="h-9 px-3 text-left font-semibold">Retries</th>
                <th className="h-9 px-3 text-left font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody>
              {job.targets.map((t) => (
                <tr key={t.id} className="border-t border-border hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs text-foreground">{t.device.serial}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{t.device.mac}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-rose-600">{t.error ?? "—"}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{t.retryCount}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{t.updatedAt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {job.targets.length === 0 && (
            <p className="text-sm text-muted-foreground p-6 text-center">No targets on this job.</p>
          )}
        </div>
      </section>
    </div>
  );
}

import { requireClient, getDeviceByMac } from "@/lib/tenant";
import { notFound } from "next/navigation";
import { Antenna, Download } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { prisma } from "@/lib/prisma";
import { LiveDataCard } from "./live-data-card";
import { RangeSelector } from "./range-selector";
import { ReadingHistoryChart } from "./reading-history-chart";
import { isHistoryRange, resolveRange, queryFieldHistory, type HistoryRange } from "@/lib/reading-history";
import type { SensorField } from "@/lib/sensor-schema";

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
  searchParams,
}: {
  params: Promise<{ mac: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { clientId } = await requireClient();
  const { mac } = await params;
  const { range: rangeParam, from, to } = await searchParams;

  const device = await getDeviceByMac(clientId, mac);
  if (!device) notFound();

  const range: HistoryRange = isHistoryRange(rangeParam) ? rangeParam : "24h";
  const resolved = resolveRange(range, from, to);
  const sensorSchema = (device.product.sensorSchema as SensorField[] | null) ?? [];

  const [rawReadings, ...fieldHistories] = await Promise.all([
    prisma.reading.findMany({
      where: { deviceId: device.id },
      orderBy: { recordedAt: "desc" },
      take: 50,
    }),
    ...sensorSchema.map((field) => queryFieldHistory(device.id, field.key, resolved)),
  ]);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-mono text-xl font-semibold text-foreground">{device.serial}</h1>
          <p className="text-sm text-muted-foreground mt-1">{device.product.name}</p>
        </div>
        <a
          href={`/devices/${mac}/export?range=${range}${range === "custom" ? `&from=${from ?? ""}&to=${to ?? ""}` : ""}`}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-white text-xs font-medium text-foreground hover:bg-slate-50 transition-colors"
        >
          <Download size={13} />
          Export CSV
        </a>
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

      <div className="mb-8">
        <LiveDataCard
          lastPayload={device.lastPayload}
          lastReadingAt={device.lastReadingAt}
          sensorSchema={sensorSchema}
          readIntervalSeconds={device.product.readInterval}
        />
      </div>

      {sensorSchema.length > 0 && (
        <section className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-foreground">History</h2>
            <RangeSelector mac={mac} current={range} customFrom={from} customTo={to} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sensorSchema.map((field, i) => (
              <ReadingHistoryChart
                key={field.key}
                label={field.label || field.key}
                unit={field.unit}
                data={fieldHistories[i].map((row) => ({
                  bucket: row.bucket.toISOString(),
                  avg: row.avg,
                  min: row.min,
                  max: row.max,
                }))}
              />
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-foreground mb-3">Raw Readings</h2>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="h-9 px-3 text-left font-semibold">Recorded</th>
                <th className="h-9 px-3 text-left font-semibold">Payload</th>
                {device.product.isCellular && <th className="h-9 px-3 text-left font-semibold">RSSI</th>}
              </tr>
            </thead>
            <tbody>
              {rawReadings.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                    {r.recordedAt.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-foreground">{JSON.stringify(r.payload)}</td>
                  {device.product.isCellular && (
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                      {r.rssi != null ? `${r.rssi} dBm` : "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {rawReadings.length === 0 && (
            <p className="text-sm text-muted-foreground p-6 text-center">No readings recorded yet.</p>
          )}
        </div>
      </section>

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

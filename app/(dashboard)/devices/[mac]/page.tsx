import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Antenna } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { EditSerialForm } from "../edit-serial-form";

import { DeviceQrDialog } from "../device-qr-dialog";
import { LiveDataCard } from "./live-data-card";
import { RangeSelector } from "./range-selector";
import { ReadingHistoryChart } from "./reading-history-chart";
import { isHistoryRange, queryFieldHistory, type HistoryRange } from "@/lib/reading-history";
import { ReadingsTable } from "@/components/readings-table";
import { ReadingsPagination } from "@/components/readings-pagination";
import type { SensorField } from "@/lib/sensor-schema";

const LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const READINGS_PAGE_SIZE = 50;

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
  searchParams: Promise<{ range?: string; page?: string }>;
}) {
  const { mac } = await params;
  const { range: rangeParam, page: pageParam } = await searchParams;
  const range: HistoryRange = isHistoryRange(rangeParam) ? rangeParam : "24h";
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const device = await prisma.device.findUnique({
    where: { mac },
    include: { product: { include: { client: true } } },
  });

  if (!device) notFound();

  const sensorSchema = (device.product.sensorSchema as SensorField[] | null) ?? [];

  const [otaHistory, rawReadings, readingCount, ...fieldHistories] = await Promise.all([
    prisma.otaTarget.findMany({
      where: { deviceId: device.id },
      orderBy: { updatedAt: "desc" },
      include: { job: { include: { firmware: true } } },
    }),
    prisma.reading.findMany({
      where: { deviceId: device.id },
      orderBy: { recordedAt: "desc" },
      skip: (page - 1) * READINGS_PAGE_SIZE,
      take: READINGS_PAGE_SIZE,
    }),
    prisma.reading.count({ where: { deviceId: device.id } }),
    ...sensorSchema.map((field) => queryFieldHistory(device.id, field.key, range)),
  ]);
  const totalPages = Math.max(1, Math.ceil(readingCount / READINGS_PAGE_SIZE));

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-mono text-xl font-semibold text-foreground">{device.mac}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Serial <span className="font-mono">{device.serial}</span> · {device.product.name}
          </p>
        </div>
        <DeviceQrDialog serial={device.serial} mac={device.mac} claimToken={device.claimToken} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Device Info</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <EditSerialForm deviceId={device.id} serial={device.serial} />
            <Field label="MAC" value={<span className="font-mono">{device.mac}</span>} />
            <Field label="Product" value={device.product.name} />
            <Field label="Client" value={device.product.client.name} />
            <Field label="State" value={<StatusBadge status={device.state} />} />
            <Field label="Firmware" value={<span className="font-mono">{device.fwVersion ?? "—"}</span>} />
            <Field label="Flashed" value={device.flashedAt.toLocaleString()} />
            <Field label="Last Seen" value={device.lastSeenAt ? device.lastSeenAt.toLocaleString() : "never"} />
          </div>
        </div>

        {device.product.isCellular && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-1.5">
              <Antenna size={14} className="text-emerald-600" />
              Cellular
            </h2>
            <div className="flex flex-col gap-4">
              <Field label="IMEI" value={<span className="font-mono">{device.imei ?? "—"}</span>} />
              <Field label="ICCID" value={<span className="font-mono">{device.iccid ?? "—"}</span>} />
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
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">History</h2>
            <RangeSelector mac={device.mac} current={range} />
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
        <ReadingsTable
          readings={rawReadings}
          sensorSchema={sensorSchema}
          isCellular={device.product.isCellular}
          footer={
            <ReadingsPagination
              basePath={`/devices/${mac}`}
              currentParams={{ range }}
              page={page}
              totalPages={totalPages}
            />
          }
        />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">OTA History</h2>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="h-9 px-3 text-left font-semibold">Version</th>
                <th className="h-9 px-3 text-left font-semibold">Status</th>
                <th className="h-9 px-3 text-left font-semibold">Error</th>
                <th className="h-9 px-3 text-left font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody>
              {otaHistory.map((t: (typeof otaHistory)[number]) => (
                <tr key={t.id} className="border-t border-border hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs font-semibold text-foreground">
                    {t.job.firmware.version}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-rose-600">{t.error ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{t.updatedAt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {otaHistory.length === 0 && (
            <p className="text-sm text-muted-foreground p-6 text-center">No OTA history for this device.</p>
          )}
        </div>
      </section>
    </div>
  );
}

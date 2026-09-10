import Link from "next/link";
import { requireClient, getDevices } from "@/lib/tenant";
import { getStaleness, formatRelativeTime, STALENESS_CLASSES } from "@/lib/staleness";
import type { SensorField } from "@/lib/sensor-schema";

export default async function DataPage() {
  const { clientId } = await requireClient();
  const devices = await getDevices(clientId);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Live Data</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Current sensor readings across your fleet, as last reported by each device.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.map((device) => {
          const sensorSchema = (device.product.sensorSchema as SensorField[] | null) ?? [];
          const payload = (device.lastPayload ?? {}) as Record<string, unknown>;
          const staleness = getStaleness(device.lastReadingAt, device.product.readInterval);

          return (
            <Link
              key={device.id}
              href={`/devices/${device.mac}`}
              className="rounded-lg border border-border bg-card p-4 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-foreground font-mono">{device.serial}</p>
                  <p className="text-xs text-muted-foreground">{device.product.name}</p>
                </div>
                <span
                  className={`inline-flex items-center h-5 px-2 rounded-full border font-mono text-[11px] font-semibold ${STALENESS_CLASSES[staleness]}`}
                >
                  {formatRelativeTime(device.lastReadingAt)}
                </span>
              </div>

              {sensorSchema.length === 0 ? (
                <p className="text-xs text-muted-foreground">No sensor data configured.</p>
              ) : device.lastReadingAt === null ? (
                <p className="text-xs text-muted-foreground">No readings yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {sensorSchema.map((field) => {
                    const raw = payload[field.key];
                    const value = typeof raw === "number" ? raw : raw != null ? String(raw) : "—";
                    return (
                      <div key={field.key} className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {field.label || field.key}
                        </span>
                        <span className="text-sm font-medium text-foreground font-mono">
                          {value}
                          {typeof raw === "number" && field.unit ? ` ${field.unit}` : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {devices.length === 0 && (
        <p className="text-sm text-muted-foreground p-6 text-center">No devices yet.</p>
      )}
    </div>
  );
}

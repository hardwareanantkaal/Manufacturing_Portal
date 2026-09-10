import { Activity } from "lucide-react";
import type { SensorField } from "@/lib/sensor-schema";
import { getStaleness, formatRelativeTime, STALENESS_CLASSES } from "@/lib/staleness";

export function LiveDataCard({
  lastPayload,
  lastReadingAt,
  sensorSchema,
  readIntervalSeconds,
}: {
  lastPayload: unknown;
  lastReadingAt: Date | null;
  sensorSchema: SensorField[];
  readIntervalSeconds: number;
}) {
  const staleness = getStaleness(lastReadingAt, readIntervalSeconds);
  const payload = (lastPayload ?? {}) as Record<string, unknown>;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Activity size={14} className="text-primary" />
          Live Data
        </h2>
        <span
          className={`inline-flex items-center h-5 px-2 rounded-full border font-mono text-[11px] font-semibold ${STALENESS_CLASSES[staleness]}`}
        >
          {formatRelativeTime(lastReadingAt)}
        </span>
      </div>

      {sensorSchema.length === 0 ? (
        <p className="text-xs text-muted-foreground">No sensor data configured for this product yet.</p>
      ) : lastReadingAt === null ? (
        <p className="text-xs text-muted-foreground">No readings received yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {sensorSchema.map((field) => {
            const raw = payload[field.key];
            const value = typeof raw === "number" ? raw : raw != null ? String(raw) : "—";
            return (
              <div key={field.key} className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
    </div>
  );
}

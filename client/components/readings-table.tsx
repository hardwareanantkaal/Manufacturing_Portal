import type { SensorField } from "@/lib/sensor-schema";

type ReadingItem = {
  id: string;
  recordedAt: Date;
  payload: unknown;
  rssi?: number | null;
};

export function ReadingsTable({
  readings,
  sensorSchema = [],
  isCellular = false,
  footer,
}: {
  readings: ReadingItem[];
  sensorSchema?: SensorField[];
  isCellular?: boolean;
  footer?: React.ReactNode;
}) {
  // Collect extra payload keys across all readings that aren't in sensorSchema
  const extraKeysSet = new Set<string>();
  readings.forEach((r) => {
    if (r.payload && typeof r.payload === "object") {
      Object.keys(r.payload as Record<string, unknown>).forEach((k) => {
        const lower = k.toLowerCase();
        const matchesSchema = sensorSchema.some(
          (s) => s.key.toLowerCase() === lower || (s.label && s.label.toLowerCase() === lower)
        );
        if (!matchesSchema) {
          extraKeysSet.add(k);
        }
      });
    }
  });
  const extraKeys = Array.from(extraKeysSet);

  const getPayloadValue = (payload: unknown, fieldKey: string, fieldLabel?: string) => {
    if (!payload || typeof payload !== "object") return undefined;
    const obj = payload as Record<string, unknown>;

    // 1. Direct match by key
    if (fieldKey in obj) return obj[fieldKey];

    // 2. Case-insensitive key match
    const lowerKey = fieldKey.toLowerCase();
    const foundByKey = Object.keys(obj).find((k) => k.toLowerCase() === lowerKey);
    if (foundByKey) return obj[foundByKey];

    // 3. Match by label if provided (e.g. key="Temp", label="Temperature", payload has "temperature")
    if (fieldLabel) {
      const lowerLabel = fieldLabel.toLowerCase();
      const foundByLabel = Object.keys(obj).find((k) => k.toLowerCase() === lowerLabel);
      if (foundByLabel) return obj[foundByLabel];
    }

    return undefined;
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="h-9 px-4 text-left font-semibold whitespace-nowrap">Recorded</th>
              {sensorSchema.map((field) => (
                <th key={field.key} className="h-9 px-4 text-left font-semibold whitespace-nowrap">
                  {field.label || field.key} {field.unit ? `(${field.unit})` : ""}
                </th>
              ))}
              {extraKeys.map((key) => (
                <th key={key} className="h-9 px-4 text-left font-semibold whitespace-nowrap capitalize">
                  {key}
                </th>
              ))}
              {isCellular && <th className="h-9 px-4 text-left font-semibold whitespace-nowrap">RSSI</th>}
            </tr>
          </thead>
          <tbody>
            {readings.map((r) => {
              const payloadObj = r.payload;
              return (
                <tr key={r.id} className="border-t border-border hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap font-mono text-xs">
                    {r.recordedAt.toLocaleString()}
                  </td>

                  {sensorSchema.map((field) => {
                    const val = getPayloadValue(payloadObj, field.key, field.label);
                    const formatted =
                      typeof val === "number"
                        ? val.toLocaleString()
                        : val != null
                        ? String(val)
                        : "—";

                    return (
                      <td key={field.key} className="px-4 py-2.5 font-mono text-xs text-foreground whitespace-nowrap">
                        <span className="font-semibold">{formatted}</span>
                        {typeof val === "number" && field.unit ? (
                          <span className="text-muted-foreground ml-1">{field.unit}</span>
                        ) : null}
                      </td>
                    );
                  })}

                  {extraKeys.map((key) => {
                    const val = getPayloadValue(payloadObj, key);
                    const formatted =
                      typeof val === "number"
                        ? val.toLocaleString()
                        : val != null
                        ? String(val)
                        : "—";

                    return (
                      <td key={key} className="px-4 py-2.5 font-mono text-xs text-foreground whitespace-nowrap">
                        <span className="font-semibold">{formatted}</span>
                      </td>
                    );
                  })}

                  {isCellular && (
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {r.rssi != null ? `${r.rssi} dBm` : "—"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {readings.length === 0 && (
        <p className="text-sm text-muted-foreground p-6 text-center">No readings recorded yet.</p>
      )}
      {footer}
    </div>
  );
}

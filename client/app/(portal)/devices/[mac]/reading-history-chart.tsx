"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export type HistoryPoint = { bucket: string; avg: number | null; min: number | null; max: number | null };

export function ReadingHistoryChart({
  label,
  unit,
  data,
}: {
  label: string;
  unit: string;
  data: HistoryPoint[];
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-xs font-semibold text-foreground mb-3">
          {label} {unit && <span className="text-muted-foreground font-normal">({unit})</span>}
        </h3>
        <p className="text-xs text-muted-foreground py-8 text-center">No readings in this range.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-xs font-semibold text-foreground mb-3">
        {label} {unit && <span className="text-muted-foreground font-normal">({unit})</span>}
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="bucket"
            tick={{ fontSize: 10 }}
            tickFormatter={(v: string) =>
              new Date(v).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
            }
            minTickGap={30}
          />
          <YAxis tick={{ fontSize: 10 }} width={40} domain={["auto", "auto"]} />
          <Tooltip
            labelFormatter={(v) => (v ? new Date(v as string).toLocaleString() : "")}
            formatter={(value) => (value == null ? "—" : Number(value).toFixed(2))}
          />
          <Line type="monotone" dataKey="avg" stroke="#2563eb" strokeWidth={1.75} dot={false} name="avg" />
          <Line type="monotone" dataKey="min" stroke="#94a3b8" strokeWidth={1} dot={false} name="min" strokeDasharray="3 3" />
          <Line type="monotone" dataKey="max" stroke="#94a3b8" strokeWidth={1} dot={false} name="max" strokeDasharray="3 3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

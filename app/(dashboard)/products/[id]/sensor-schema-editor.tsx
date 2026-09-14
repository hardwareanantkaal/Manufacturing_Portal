"use client";

import { useState } from "react";
import { Plus, Trash2, Sparkles } from "lucide-react";
import type { SensorField } from "@/lib/sensor-schema";

const CELL_CLASS =
  "h-8 rounded-md border border-input bg-white px-2 text-xs outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30";

function labelFromKey(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export type DetectedField = { key: string; sample: number };

export function SensorSchemaEditor({
  initial,
  detected = [],
}: {
  initial: SensorField[];
  detected?: DetectedField[];
}) {
  const [fields, setFields] = useState<SensorField[]>(initial.length > 0 ? initial : []);

  function update(i: number, patch: Partial<SensorField>) {
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function addRow() {
    setFields((prev) => [...prev, { key: "", label: "", unit: "" }]);
  }

  function addDetected(key: string) {
    setFields((prev) => [...prev, { key, label: labelFromKey(key), unit: "" }]);
  }

  function removeRow(i: number) {
    setFields((prev) => prev.filter((_, idx) => idx !== i));
  }

  const configuredKeys = new Set(fields.map((f) => f.key.toLowerCase()));
  const unconfiguredDetected = detected.filter((d) => !configuredKeys.has(d.key.toLowerCase()));

  return (
    <div>
      <input type="hidden" name="sensorSchema" value={JSON.stringify(fields)} />

      {unconfiguredDetected.length > 0 && (
        <div className="mb-3 p-2.5 rounded-md bg-blue-50 border border-blue-100">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700 mb-1.5 flex items-center gap-1">
            <Sparkles size={11} />
            Seen in incoming data, not yet configured
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unconfiguredDetected.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => addDetected(d.key)}
                className="inline-flex items-center gap-1 h-6 px-2 rounded-full border border-blue-200 bg-white text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <Plus size={11} />
                {d.key}
                <span className="text-blue-400 font-mono">({d.sample})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {fields.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={f.key}
              onChange={(e) => update(i, { key: e.target.value })}
              placeholder="key (temp)"
              className={`${CELL_CLASS} w-28`}
            />
            <input
              value={f.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="label (Temperature)"
              className={`${CELL_CLASS} w-36`}
            />
            <input
              value={f.unit}
              onChange={(e) => update(i, { unit: e.target.value })}
              placeholder="unit (°C)"
              className={`${CELL_CLASS} w-20`}
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="p-1.5 rounded text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <Plus size={13} />
        Add sensor field
      </button>
    </div>
  );
}

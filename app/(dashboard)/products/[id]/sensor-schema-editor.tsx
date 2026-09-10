"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

export type SensorField = { key: string; label: string; unit: string; min: number | null; max: number | null };

const CELL_CLASS =
  "h-8 rounded-md border border-input bg-white px-2 text-xs outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30";

export function SensorSchemaEditor({ initial }: { initial: SensorField[] }) {
  const [fields, setFields] = useState<SensorField[]>(initial.length > 0 ? initial : []);

  function update(i: number, patch: Partial<SensorField>) {
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function addRow() {
    setFields((prev) => [...prev, { key: "", label: "", unit: "", min: null, max: null }]);
  }

  function removeRow(i: number) {
    setFields((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <input type="hidden" name="sensorSchema" value={JSON.stringify(fields)} />
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
            <input
              type="number"
              value={f.min ?? ""}
              onChange={(e) => update(i, { min: e.target.value === "" ? null : Number(e.target.value) })}
              placeholder="min"
              className={`${CELL_CLASS} w-20`}
            />
            <input
              type="number"
              value={f.max ?? ""}
              onChange={(e) => update(i, { max: e.target.value === "" ? null : Number(e.target.value) })}
              placeholder="max"
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

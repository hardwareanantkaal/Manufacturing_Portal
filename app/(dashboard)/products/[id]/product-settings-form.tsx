"use client";

import { useActionState } from "react";
import { updateProductSettings } from "./actions";
import { SensorSchemaEditor, type DetectedField } from "./sensor-schema-editor";
import type { SensorField } from "@/lib/sensor-schema";

const INPUT_CLASS =
  "h-8 rounded-md border border-input bg-white px-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30";
const LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

export function ProductSettingsForm({
  productId,
  productKey,
  readInterval,
  sensorSchema,
  detectedFields,
}: {
  productId: string;
  productKey: string;
  readInterval: number;
  sensorSchema: SensorField[];
  detectedFields: DetectedField[];
}) {
  const [error, formAction, pending] = useActionState(updateProductSettings, null);

  return (
    <form action={formAction} className="flex flex-col gap-4 p-4 rounded-lg border border-border bg-card">
      <input type="hidden" name="productId" value={productId} />

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Product key</label>
          <input
            name="productKey"
            defaultValue={productKey}
            required
            pattern="[a-z0-9-]+"
            className={`${INPUT_CLASS} w-56 font-mono`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Read interval (seconds)</label>
          <input
            name="readInterval"
            type="number"
            min={1}
            defaultValue={readInterval}
            required
            className={`${INPUT_CLASS} w-32`}
          />
        </div>
      </div>

      <div>
        <label className={`${LABEL_CLASS} block mb-2`}>Sensor schema</label>
        <SensorSchemaEditor initial={sensorSchema} detected={detectedFields} />
      </div>

      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="h-8 px-3.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}

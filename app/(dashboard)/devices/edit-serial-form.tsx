"use client";

import { useActionState } from "react";
import { updateDeviceSerial } from "./actions";

const LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

export function EditSerialForm({ deviceId, serial }: { deviceId: string; serial: string }) {
  const [error, formAction, isPending] = useActionState(updateDeviceSerial, null);

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <label className={LABEL_CLASS}>Serial</label>
      <div className="flex items-center gap-1.5">
        <input type="hidden" name="deviceId" value={deviceId} />
        <input
          name="serial"
          defaultValue={serial}
          maxLength={6}
          pattern="\d{6}"
          title="Exactly 6 digits"
          className="h-7 w-24 rounded-md border border-input bg-white px-2 font-mono text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
        <button
          type="submit"
          disabled={isPending}
          className="h-7 px-2.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </form>
  );
}

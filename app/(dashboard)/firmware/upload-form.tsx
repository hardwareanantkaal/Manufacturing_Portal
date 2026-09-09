"use client";

import { useActionState } from "react";
import type { Product } from "@prisma/client";
import { uploadFirmware } from "./actions";

const SELECT_CLASS =
  "h-8 rounded-md border border-input bg-white px-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";
const INPUT_CLASS =
  "h-8 rounded-md border border-input bg-white px-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30";
const LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

export function UploadForm({ products }: { products: Product[] }) {
  const [error, formAction, isPending] = useActionState(uploadFirmware, null);

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-2 mb-6 p-3 rounded-lg border border-border bg-card"
    >
      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASS}>Product</label>
        <select name="productId" required className={SELECT_CLASS}>
          <option value="">Select product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASS}>Version</label>
        <input name="version" placeholder="1.4.2" required className={`${INPUT_CLASS} w-28`} />
      </div>
      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASS}>Firmware (.bin)</label>
        <input
          name="file"
          type="file"
          accept=".bin"
          required
          className="h-8 text-sm file:h-full file:mr-2 file:px-3 file:rounded-md file:border-0 file:bg-secondary file:text-secondary-foreground file:text-sm"
        />
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
        <label className={LABEL_CLASS}>Release notes</label>
        <input name="notes" placeholder="Optional" className={INPUT_CLASS} />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="h-8 px-3.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {isPending ? "Uploading..." : "Upload Firmware"}
      </button>
      {error && <p className="text-xs text-rose-600 w-full">{error}</p>}
    </form>
  );
}

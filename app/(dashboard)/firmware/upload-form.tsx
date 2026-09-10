"use client";

import { useActionState, useState } from "react";
import type { Product } from "@prisma/client";
import { uploadFirmware } from "./actions";
import { Info, AlertTriangle } from "lucide-react";

const SELECT_CLASS =
  "h-8 rounded-md border border-input bg-white px-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";
const INPUT_CLASS =
  "h-8 rounded-md border border-input bg-white px-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30";
const LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

export function UploadForm({ products }: { products: Product[] }) {
  const [error, formAction, isPending] = useActionState(uploadFirmware, null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [fileName, setFileName] = useState("");

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const isEsp32Product = selectedProduct?.chipFamily?.toLowerCase().includes("esp32");
  const isNotMergedBin = fileName && !fileName.toLowerCase().endsWith(".merged.bin");

  return (
    <div className="flex flex-col gap-2 mb-6">
      <form
        action={formAction}
        className="flex flex-wrap items-end gap-2 p-3 rounded-lg border border-border bg-card"
      >
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Product</label>
          <select
            name="productId"
            required
            className={SELECT_CLASS}
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
          >
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.chipFamily})
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
            onChange={(e) => {
              const file = e.target.files?.[0];
              setFileName(file ? file.name : "");
            }}
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
        {error && <p className="text-xs text-rose-600 w-full mt-1">{error}</p>}
      </form>

      {/* ESP32 Merged Binary Reminder Banner */}
      {isEsp32Product && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-xs text-blue-900 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-blue-950">
            <Info size={14} className="text-blue-600 shrink-0" />
            <span>ESP32 Merged Binary Reminder</span>
          </div>
          <p className="leading-relaxed">
            For ESP32 Web Serial flashing at offset <code className="font-mono bg-blue-100 px-1 rounded text-blue-900 font-semibold">0x0</code>, please upload the <strong>merged binary</strong> file (e.g. <code className="font-mono bg-blue-100 px-1 rounded text-blue-900 font-semibold">ArgusSleep.ino.merged.bin</code>).
          </p>
          <span className="text-[11px] text-blue-700">
            💡 In Arduino IDE, export via: <strong>Sketch → Export Compiled Binary</strong>. Standard <code className="font-mono">.bin</code> files missing the bootloader & partition table will not boot when flashed at offset 0x0.
          </span>
        </div>
      )}

      {/* Warning if standard app .bin selected for ESP32 */}
      {isEsp32Product && isNotMergedBin && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-950">File Warning: </span>
            Selected file <code className="font-mono bg-amber-100 px-1 rounded font-semibold">{fileName}</code> is a standard application binary. For Web Serial flashing at 0x0, use the <code className="font-mono bg-amber-100 px-1 rounded font-semibold">*.merged.bin</code> file!
          </div>
        </div>
      )}
    </div>
  );
}

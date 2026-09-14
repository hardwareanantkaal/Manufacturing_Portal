"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { regenerateApiKey } from "./actions";

export function RegenerateKeyButton({ productId, productName }: { productId: string; productName: string }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();

  const matches = confirmText === productName;

  function close() {
    setOpen(false);
    setConfirmText("");
  }

  function handleConfirm() {
    if (!matches) return;
    startTransition(async () => {
      await regenerateApiKey(productId);
      close();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 transition-colors"
      >
        <RefreshCw size={12} />
        Regenerate
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white border border-border shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 h-12 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <AlertTriangle size={15} className="text-rose-600" />
                Regenerate API Key
              </h2>
              <button
                type="button"
                onClick={close}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3">
              <div className="rounded-md bg-rose-50 border border-rose-200 p-3">
                <p className="text-xs text-rose-800 font-medium">
                  This immediately breaks every device already deployed with the current key.
                </p>
                <p className="text-xs text-rose-700 mt-1">
                  Every device using the old key will start getting <strong>401 Unauthorized</strong> on
                  every request — no data, no OTA — until each one is individually reflashed or
                  reconfigured with the new key. This cannot be undone.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">
                  Type <span className="font-mono text-foreground">{productName}</span> to confirm
                </label>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={productName}
                  autoComplete="off"
                  className="w-full h-8 rounded-md border border-input bg-white px-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={close}
                  className="h-8 px-3.5 rounded-md border border-border bg-white text-sm font-medium text-foreground hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!matches || pending}
                  className="h-8 px-3.5 rounded-md bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {pending ? "Regenerating…" : "Regenerate key"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { QrCode, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DeviceQrDialogProps {
  serial: string;
  mac: string;
  claimToken: string;
}

export function DeviceQrDialog({ serial, mac, claimToken }: DeviceQrDialogProps) {
  const [open, setOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (open && claimToken) {
      const claimUrl = `https://portal.anantkaal.com/claim/${mac}/${serial}/${claimToken}`;
      QRCode.toDataURL(claimUrl, { margin: 1, width: 200 })
        .then((url) => setQrDataUrl(url))
        .catch(console.error);
    }
  }, [open, mac, serial, claimToken]);

  function handlePrint() {
    window.print();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        type="button"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border text-foreground hover:bg-slate-100 transition-colors"
      >
        <QrCode size={13} className="text-muted-foreground" />
        <span>View QR</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Device Sticker & QR Code</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-3">
          <div
            id="print-device-sticker"
            className="flex flex-col items-center gap-2.5 p-5 border border-border rounded-xl bg-white shadow-xs w-64"
          >
            {qrDataUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={qrDataUrl}
                alt={`QR code for device ${serial}`}
                width={160}
                height={160}
                className="w-40 h-40"
              />
            ) : (
              <div className="w-40 h-40 flex items-center justify-center text-xs text-muted-foreground bg-slate-50 animate-pulse rounded-lg">
                Generating QR...
              </div>
            )}
            <div className="text-center font-mono w-full border-t border-slate-100 pt-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wider text-[10px]">
                Serial Number
              </div>
              <div className="text-lg font-bold text-foreground leading-tight">{serial}</div>
              <div className="text-[11px] text-muted-foreground mt-1">MAC: {mac}</div>
            </div>
          </div>

          <div className="w-full flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-blue-700 transition-colors"
            >
              <Printer size={13} />
              Print Sticker
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

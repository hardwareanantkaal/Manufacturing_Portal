"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { QrCode, X, Camera } from "lucide-react";

// Matches the /claim/{mac}/{token} path the admin's device QR encodes —
// mac is 12 hex chars, token is the 32-hex-char value from
// lib/claim-token.ts. Only the path is ever used, never the scanned
// string's own host, so this can't be turned into an open redirect by
// scanning (or pasting) a QR/link pointing somewhere else entirely.
const CLAIM_PATH_REGEX = /\/claim\/([0-9A-Fa-f]{12})\/([0-9a-f]{32})(?:[/?#]|$)/;

function extractClaimPath(raw: string): string | null {
  const match = CLAIM_PATH_REGEX.exec(raw.trim());
  if (!match) return null;
  return `/claim/${match[1].toUpperCase()}/${match[2]}`;
}

export function ScanDeviceDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);

  function stopCamera() {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function handleDecoded(raw: string) {
    const path = extractClaimPath(raw);
    if (!path) {
      setError("That QR code isn't a device claim code. Make sure you're scanning the code from the device's sticker.");
      return;
    }
    stopCamera();
    router.push(path);
  }

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        const tick = () => {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height);
              if (code) {
                handleDecoded(code.data);
                return;
              }
            }
          }
          frameRef.current = requestAnimationFrame(tick);
        };
        frameRef.current = requestAnimationFrame(tick);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Couldn't access the camera. Check your browser's camera permission, or enter the code manually below.");
        }
      });

    return () => {
      cancelled = true;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleDecoded(manualValue);
  }

  function openDialog() {
    setError(null);
    setManualValue("");
    setOpen(true);
  }

  function close() {
    stopCamera();
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        <QrCode size={14} />
        Add Device
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white border border-border shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 h-12 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Camera size={15} />
                Scan Device QR
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
              <p className="text-xs text-muted-foreground">
                Point your camera at the QR code on the device&apos;s sticker.
              </p>

              <div className="relative w-full aspect-square rounded-md bg-slate-900 overflow-hidden">
                <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
              </div>

              {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

              <div className="pt-2 border-t border-border">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Or enter the claim link manually
                </p>
                <form onSubmit={handleManualSubmit} className="flex gap-2">
                  <input
                    value={manualValue}
                    onChange={(e) => setManualValue(e.target.value)}
                    placeholder="Paste the claim link or code"
                    className="flex-1 h-8 rounded-md border border-input bg-white px-2.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                  />
                  <button
                    type="submit"
                    className="h-8 px-3 rounded-md bg-secondary text-secondary-foreground text-xs font-medium hover:bg-slate-200 transition-colors"
                  >
                    Go
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

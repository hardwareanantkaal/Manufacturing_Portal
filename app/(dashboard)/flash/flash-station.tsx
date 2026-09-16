"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Client, Product, Firmware } from "@prisma/client";
import { ESPLoader, Transport, type IEspLoaderTerminal } from "esptool-js";
import QRCode from "qrcode";
import {
  Cable,
  ClipboardCheck,
  Zap,
  Printer,
  Terminal,
  Play,
  Square,
  Trash2,
} from "lucide-react";

type ProductWithFirmware = Product & { firmwares: Firmware[] };

const SELECT_CLASS =
  "h-8 rounded-md border border-input bg-white px-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50 disabled:cursor-not-allowed";
const INPUT_CLASS =
  "h-8 rounded-md border border-input bg-white px-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30";
const LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

type FlashState =
  | "idle"
  | "connecting"
  | "connected"
  | "registering"
  | "registered"
  | "flashing"
  | "done"
  | "error";

const BUSY_STATES: FlashState[] = ["connecting", "registering", "flashing"];

function subscribeNoop() {
  return () => {};
}
function getWebSerialSnapshot() {
  return "serial" in navigator;
}
function getWebSerialServerSnapshot() {
  return true;
}

export function FlashStation({
  clients,
  products,
}: {
  clients: Client[];
  products: ProductWithFirmware[];
}) {
  const [clientId, setClientId] = useState("");
  const [productId, setProductId] = useState("");
  const [firmwareId, setFirmwareId] = useState("");
  const [imei, setImei] = useState("");
  const [iccid, setIccid] = useState("");

  const [flashState, setFlashState] = useState<FlashState>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [detectedMac, setDetectedMac] = useState<string | null>(null);
  const [serial, setSerial] = useState<string | null>(null);
  const [customSerial, setCustomSerial] = useState("");
  const [serialError, setSerialError] = useState<string | null>(null);
  const [checkingSerial, setCheckingSerial] = useState(false);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Serial Monitor states
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitorBaudRate, setMonitorBaudRate] = useState("115200");
  const monitorReaderRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const activePortRef = useRef<SerialPort | null>(null);
  // true only while WE are the ones canceling the reader (via Stop Monitor),
  // so the catch block can tell "you clicked stop" apart from "the port
  // actually dropped" instead of guessing from the error's text.
  const stopRequestedRef = useRef(false);

  const transportRef = useRef<Transport | null>(null);
  const esploaderRef = useRef<ESPLoader | null>(null);
  const logBoxRef = useRef<HTMLDivElement | null>(null);

  const filteredProducts = products.filter((p) => p.clientId === clientId);
  const selectedProduct = products.find((p) => p.id === productId);
  const firmwares = selectedProduct?.firmwares ?? [];
  const selectedFirmware = firmwares.find((f) => f.id === firmwareId);

  const webSerialAvailable = useSyncExternalStore(
    subscribeNoop,
    getWebSerialSnapshot,
    getWebSerialServerSnapshot
  );

  function appendLog(line: string) {
    setLog((prev) => [...prev, line]);
    requestAnimationFrame(() => {
      logBoxRef.current?.scrollTo({ top: logBoxRef.current.scrollHeight });
    });
  }

  // Fetch proposed next serial or existing registered serial when product or detected MAC changes
  useEffect(() => {
    if (!productId) return;

    let canceled = false;
    async function fetchSerialSuggestion() {
      setCheckingSerial(true);
      try {
        const url = `/api/devices/serial?productId=${productId}${
          detectedMac ? `&mac=${detectedMac}` : ""
        }`;
        const res = await fetch(url);
        if (res.ok && !canceled) {
          const data = await res.json();
          setCustomSerial(data.serial);
          setSerial(data.serial);
          if (data.claimToken) {
            setClaimToken(data.claimToken);
          }
          setSerialError(null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!canceled) setCheckingSerial(false);
      }
    }

    fetchSerialSuggestion();
    return () => {
      canceled = true;
    };
  }, [productId, detectedMac]);

  async function handleSerialChange(val: string) {
    setCustomSerial(val);
    setSerial(val);

    if (!val.trim()) {
      setSerialError("Serial number is required");
      return;
    }
    if (!productId) {
      setSerialError("Please select a product first");
      return;
    }

    setCheckingSerial(true);
    try {
      const url = `/api/devices/serial?productId=${productId}&serial=${encodeURIComponent(
        val.trim()
      )}${detectedMac ? `&mac=${detectedMac}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (!data.available) {
          setSerialError(`Serial '${val.trim()}' is already used for this product.`);
        } else {
          setSerialError(null);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingSerial(false);
    }
  }

  async function stopSerialMonitor() {
    if (monitorReaderRef.current) {
      stopRequestedRef.current = true;
      try {
        await monitorReaderRef.current.cancel();
        monitorReaderRef.current.releaseLock();
      } catch (e) {
        console.error("Error releasing monitor lock:", e);
      }
      monitorReaderRef.current = null;
    }
    setIsMonitoring(false);
  }

  async function startSerialMonitor() {
    setErrorMessage(null);

    if (isMonitoring) {
      await stopSerialMonitor();
      appendLog("--- Serial Monitor Stopped ---");
      return;
    }

    stopRequestedRef.current = false;

    try {
      // Release esptool-js transport lock if present
      if (transportRef.current) {
        try {
          await transportRef.current.disconnect();
        } catch (e) {
          // Ignore disconnect error
        }
        transportRef.current = null;
        esploaderRef.current = null;
      }

      let port: SerialPort | null = activePortRef.current;
      if (!port) {
        port = await navigator.serial.requestPort();
        activePortRef.current = port;
      }

      if (!port) {
        throw new Error("No serial port selected");
      }

      const baudRateNum = parseInt(monitorBaudRate, 10);
      try {
        await port.open({ baudRate: baudRateNum });
      } catch (err) {
        if (!String(err).includes("already open")) {
          throw err; // a real open failure — don't pretend it succeeded
        }
        await port.close();
        await port.open({ baudRate: baudRateNum });
      }

      if (!port.readable) {
        throw new Error("Serial port readable stream is not available. Please reconnect device.");
      }

      if (port.readable.locked) {
        await new Promise((r) => setTimeout(r, 200));
        if (port.readable.locked) {
          throw new Error("Serial stream is currently locked. Please disconnect and reconnect.");
        }
      }

      setIsMonitoring(true);
      appendLog(`--- Live Serial Monitor Started (${monitorBaudRate} baud) ---`);

      const reader = port.readable.getReader();
      monitorReaderRef.current = reader as unknown as ReadableStreamDefaultReader<string>;
      const decoder = new TextDecoder();
      let partialLine = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          const textChunk = decoder.decode(value, { stream: true });
          partialLine += textChunk;
          const lines = partialLine.split("\n");
          partialLine = lines.pop() ?? "";
          for (const line of lines) {
            const cleanLine = line.replace(/\r/g, "");
            if (cleanLine.trim() !== "") {
              appendLog(cleanLine);
            }
          }
        }
      }
    } catch (err) {
      if (!stopRequestedRef.current) {
        // Only suppress the error when WE requested the stop (Stop Monitor
        // button) — anything else, including the port dropping on its own
        // right after a reset, gets surfaced instead of hidden.
        appendLog(`--- Serial Monitor Error: ${err instanceof Error ? err.message : String(err)} ---`);
        setErrorMessage(err instanceof Error ? err.message : String(err));
      }
    } finally {
      stopRequestedRef.current = false;
      setIsMonitoring(false);
    }
  }

  async function handleConnect() {
    setErrorMessage(null);
    if (isMonitoring) {
      await stopSerialMonitor();
    }

    setFlashState("connecting");
    setLog([]);

    try {
      const port = await navigator.serial.requestPort();
      activePortRef.current = port;
      const transport = new Transport(port, false);

      const terminal: IEspLoaderTerminal = {
        clean: () => setLog([]),
        writeLine: (data) => appendLog(data),
        write: (data) => appendLog(data),
      };

      const esploader = new ESPLoader({ transport, baudrate: 115200, terminal });
      const chipName = await esploader.main();
      appendLog(`Chip detected: ${chipName}`);

      const rawMac = await esploader.chip.readMac(esploader);
      const mac = rawMac.replace(/:/g, "").toUpperCase();
      appendLog(`MAC address: ${mac}`);

      transportRef.current = transport;
      esploaderRef.current = esploader;
      setDetectedMac(mac);
      setFlashState("connected");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setFlashState("error");
    }
  }

  async function registerDeviceInternal(serialOverride?: string) {
    if (!detectedMac || !selectedProduct) {
      throw new Error("Device MAC and Product must be selected before registering");
    }

    const activeSerial = (serialOverride || customSerial || serial || "").trim();
    if (!activeSerial) {
      throw new Error("Serial number is required");
    }

    appendLog("Registering device...");
    const registerRes = await fetch("/api/devices/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mac: detectedMac,
        productId: selectedProduct.id,
        serial: activeSerial,
        imei: selectedProduct.isCellular ? imei || undefined : undefined,
        iccid: selectedProduct.isCellular ? iccid || undefined : undefined,
        firmwareVersion: selectedFirmware?.version,
      }),
    });

    if (!registerRes.ok) {
      const body = await registerRes.json().catch(() => null);
      throw new Error(body?.error ?? "Device registration failed");
    }

    const data = await registerRes.json();
    setSerial(data.serial);
    setCustomSerial(data.serial);
    setClaimToken(data.claimToken);
    appendLog(`Registered as serial ${data.serial}`);
    setFlashState("registered");
    return data;
  }

  async function handleRegister() {
    setErrorMessage(null);
    setFlashState("registering");
    try {
      await registerDeviceInternal();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setFlashState("error");
    }
  }

  async function handleFlash() {
    if (!esploaderRef.current || !detectedMac || !selectedFirmware || !selectedProduct) return;

    setErrorMessage(null);
    if (isMonitoring) {
      await stopSerialMonitor();
    }

    setProgress(0);

    try {
      let activeClaimToken = claimToken;
      let activeSerial = customSerial || serial || "";

      if (!claimToken || flashState !== "registered") {
        setFlashState("registering");
        const regData = await registerDeviceInternal(activeSerial);
        activeClaimToken = regData.claimToken;
        activeSerial = regData.serial;
      }

      setFlashState("flashing");
      appendLog(`Downloading firmware ${selectedFirmware.version}...`);
      // Not selectedFirmware.binUrl directly — that's a private Blob URL now,
      // not fetchable from the browser. Goes through the same admin-session-
      // gated download route the Firmware page's "Download" link uses.
      const binRes = await fetch(`/firmware/${selectedFirmware.id}/download`);
      if (!binRes.ok) throw new Error(`Could not download firmware ${selectedFirmware.version}`);
      const firmwareData = new Uint8Array(await binRes.arrayBuffer());

      appendLog(`Flashing ${(firmwareData.byteLength / 1024).toFixed(0)} KB...`);
      await esploaderRef.current.writeFlash({
        fileArray: [{ data: firmwareData, address: 0x0 }],
        flashMode: "keep",
        flashFreq: "keep",
        flashSize: "keep",
        eraseAll: false,
        compress: true,
        reportProgress: (_fileIndex, written, total) => {
          setProgress(Math.round((written / total) * 100));
        },
      });

      await esploaderRef.current.after("hard_reset");
      appendLog("Flash complete. Device reset.");

      if (activeClaimToken && activeSerial) {
        const claimUrl = `${process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL}/claim/${detectedMac}/${activeClaimToken}`;
        const dataUrl = await QRCode.toDataURL(claimUrl, { margin: 1, width: 180 });
        setQrDataUrl(dataUrl);
      }

      setFlashState("done");

      // Auto-start live serial monitor after flash completes
      setTimeout(() => {
        startSerialMonitor().catch(console.error);
      }, 500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setFlashState("error");
    }
  }

  function resetForNextDevice() {
    stopSerialMonitor().catch(() => {});
    transportRef.current?.disconnect().catch(() => {});
    transportRef.current = null;
    esploaderRef.current = null;
    activePortRef.current = null;
    setFlashState("idle");
    setDetectedMac(null);
    setSerial(null);
    setCustomSerial("");
    setSerialError(null);
    setClaimToken(null);
    setQrDataUrl(null);
    setProgress(0);
    setLog([]);
    setImei("");
    setIccid("");
  }

  const busy = BUSY_STATES.includes(flashState);
  const hasMac = !!detectedMac;
  const hasProduct = !!selectedProduct;
  const validSerial = !!customSerial.trim() && !serialError;

  const canRegister = hasMac && hasProduct && validSerial && !busy;
  const canFlash = hasMac && hasProduct && !!firmwareId && validSerial && !busy;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 flex flex-col gap-4">
        {!webSerialAvailable && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm px-4 py-3">
            Web Serial is not available in this browser. Use Google Chrome or Microsoft Edge,
            over HTTPS or localhost, to flash devices.
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className={LABEL_CLASS}>Client</label>
              <select
                className={SELECT_CLASS}
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setProductId("");
                  setFirmwareId("");
                  setCustomSerial("");
                  setSerial(null);
                  setSerialError(null);
                }}
                disabled={busy}
              >
                <option value="">Select client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={LABEL_CLASS}>Product</label>
              <select
                className={SELECT_CLASS}
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  setFirmwareId("");
                  if (!e.target.value) {
                    setCustomSerial("");
                    setSerial(null);
                    setSerialError(null);
                  }
                }}
                disabled={!clientId || busy}
              >
                <option value="">Select product</option>
                {filteredProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={LABEL_CLASS}>Firmware</label>
              <select
                className={SELECT_CLASS}
                value={firmwareId}
                onChange={(e) => setFirmwareId(e.target.value)}
                disabled={!productId || busy}
              >
                <option value="">Select version</option>
                {firmwares.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.version} ({f.channel})
                  </option>
                ))}
              </select>
              {productId && firmwares.length === 0 && (
                <span className="text-[11px] text-muted-foreground">
                  No firmware uploaded for this product yet.
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleConnect}
              disabled={!webSerialAvailable || busy}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              <Cable size={14} />
              {flashState === "connecting" ? "Connecting..." : "Connect Device"}
            </button>
            <button
              type="button"
              onClick={handleRegister}
              disabled={!canRegister}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              <ClipboardCheck size={14} />
              {flashState === "registering" ? "Registering..." : "Register Device"}
            </button>
            <button
              type="button"
              onClick={handleFlash}
              disabled={!canFlash}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Zap size={14} />
              {flashState === "flashing" ? "Flashing..." : "Flash"}
            </button>
            {flashState === "done" && (
              <button
                type="button"
                onClick={resetForNextDevice}
                className="h-9 px-3.5 rounded-md border border-border text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Flash Another
              </button>
            )}
          </div>

          {errorMessage && <p className="text-xs text-rose-600">{errorMessage}</p>}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-foreground">Progress</h2>
            <span className="font-mono text-xs text-muted-foreground">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Live Serial Monitor Console */}
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-emerald-400" />
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center">
                Serial Monitor
                {isMonitoring && (
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-2" />
                )}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={monitorBaudRate}
                onChange={(e) => setMonitorBaudRate(e.target.value)}
                disabled={isMonitoring || busy}
                className="h-7 rounded border border-slate-700 bg-slate-800 px-2 text-xs font-mono text-slate-300 outline-none focus:border-slate-500"
              >
                <option value="9600">9600 baud</option>
                <option value="115200">115200 baud</option>
                <option value="230400">230400 baud</option>
                <option value="921600">921600 baud</option>
              </select>

              <button
                type="button"
                onClick={startSerialMonitor}
                disabled={busy || !webSerialAvailable}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-xs font-medium transition-colors ${
                  isMonitoring
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                }`}
              >
                {isMonitoring ? (
                  <>
                    <Square size={12} /> Stop Monitor
                  </>
                ) : (
                  <>
                    <Play size={12} /> Start Monitor
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setLog([])}
                title="Clear Console"
                className="inline-flex items-center justify-center h-7 w-7 rounded border border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          <div
            ref={logBoxRef}
            className="h-64 overflow-y-auto font-mono text-xs text-emerald-400 whitespace-pre-wrap leading-relaxed border-t border-slate-800 pt-2"
          >
            {log.length === 0 ? (
              <span className="text-slate-500">Waiting for device connection or serial logs...</span>
            ) : (
              log.map((line, i) => <div key={i}>{line}</div>)
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className={LABEL_CLASS}>Detected MAC</h2>
          <p className="font-mono text-lg font-semibold text-foreground mt-1 break-all">
            {detectedMac ?? "—"}
          </p>

          <h2 className={`${LABEL_CLASS} mt-4`}>Serial Number</h2>
          <div className="flex flex-col gap-1 mt-1">
            <input
              type="text"
              className={`${INPUT_CLASS} font-mono text-base font-semibold ${
                serialError ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20" : ""
              }`}
              value={customSerial}
              onChange={(e) => handleSerialChange(e.target.value)}
              placeholder={checkingSerial ? "Loading..." : "e.g. 000001"}
              disabled={busy || !selectedProduct}
            />
            {serialError && (
              <span className="text-xs font-medium text-rose-600">{serialError}</span>
            )}
            {!selectedProduct && (
              <span className="text-[11px] text-muted-foreground">Select a product to set serial</span>
            )}
          </div>
        </div>

        {selectedProduct?.isCellular && (
          <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">Cellular</h2>
            <div className="flex flex-col gap-1">
              <label className={LABEL_CLASS}>IMEI</label>
              <input
                className={`${INPUT_CLASS} font-mono`}
                value={imei}
                onChange={(e) => setImei(e.target.value)}
                placeholder="15-digit IMEI"
                disabled={busy}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={LABEL_CLASS}>ICCID</label>
              <input
                className={`${INPUT_CLASS} font-mono`}
                value={iccid}
                onChange={(e) => setIccid(e.target.value)}
                placeholder="SIM ICCID"
                disabled={busy}
              />
            </div>
          </div>
        )}

        {flashState === "done" && qrDataUrl && (
          <div className="rounded-lg border border-border bg-card p-4 flex flex-col items-center gap-3">
            <h2 className="text-sm font-semibold text-foreground self-start print:hidden">
              Device Sticker
            </h2>
            <div id="print-sticker" className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Device claim QR code" width={140} height={140} />
              <p className="font-mono text-sm font-semibold">{serial}</p>
              <p className="font-mono text-xs text-muted-foreground print:hidden">{detectedMac}</p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-sm font-medium hover:bg-slate-50 transition-colors print:hidden"
            >
              <Printer size={14} />
              Print Sticker
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOtaJob } from "./actions";

type FirmwareOption = { id: string; version: string; channel: string; sizeBytes: number };
type ProductOption = {
  id: string;
  name: string;
  isCellular: boolean;
  firmwares: FirmwareOption[];
};
type DeviceOption = { id: string; serial: string; mac: string; state: string; productId: string };

const SELECT_CLASS =
  "h-8 rounded-md border border-input bg-white px-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";
const LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

const DEVICE_STATES = ["flashed", "shipped", "active", "offline", "rma"];

export function CreateJobPanel({
  products,
  devices,
}: {
  products: ProductOption[];
  devices: DeviceOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [productId, setProductId] = useState("");
  const [firmwareId, setFirmwareId] = useState("");
  const [targetMode, setTargetMode] = useState<"all" | "filtered">("all");
  const [stateFilter, setStateFilter] = useState("active");
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState(false);

  const selectedProduct = products.find((p) => p.id === productId);
  const firmwares = selectedProduct?.firmwares ?? [];
  const selectedFirmware = firmwares.find((f) => f.id === firmwareId);

  const productDevices = useMemo(
    () => devices.filter((d) => d.productId === productId),
    [devices, productId]
  );
  const targetDevices = useMemo(
    () =>
      targetMode === "all"
        ? productDevices
        : productDevices.filter((d) => d.state === stateFilter),
    [productDevices, targetMode, stateFilter]
  );

  const cellularCount = selectedProduct?.isCellular ? targetDevices.length : 0;
  const wifiCount = selectedProduct?.isCellular ? 0 : targetDevices.length;
  const estimatedDataMb =
    selectedProduct?.isCellular && selectedFirmware
      ? (selectedFirmware.sizeBytes * targetDevices.length) / 1024 / 1024
      : 0;

  function handleCreate() {
    setError(null);
    setJustCreated(false);
    startTransition(async () => {
      const result = await createOtaJob({
        firmwareId,
        deviceIds: targetDevices.map((d) => d.id),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setJustCreated(true);
      setProductId("");
      setFirmwareId("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 mb-6 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Create OTA Job</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Product</label>
          <select
            className={SELECT_CLASS}
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setFirmwareId("");
            }}
          >
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Firmware version</label>
          <select
            className={SELECT_CLASS}
            value={firmwareId}
            onChange={(e) => setFirmwareId(e.target.value)}
            disabled={!productId}
          >
            <option value="">Select version</option>
            {firmwares.map((f) => (
              <option key={f.id} value={f.id}>
                {f.version} ({f.channel})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Targets</label>
          <div className="flex items-center gap-3 h-8">
            <label className="flex items-center gap-1.5 text-sm text-foreground">
              <input
                type="radio"
                name="targetMode"
                checked={targetMode === "all"}
                onChange={() => setTargetMode("all")}
                className="accent-primary"
              />
              All devices
            </label>
            <label className="flex items-center gap-1.5 text-sm text-foreground">
              <input
                type="radio"
                name="targetMode"
                checked={targetMode === "filtered"}
                onChange={() => setTargetMode("filtered")}
                className="accent-primary"
              />
              Filter by state
            </label>
          </div>
        </div>
      </div>

      {targetMode === "filtered" && (
        <div className="flex flex-col gap-1 w-40">
          <label className={LABEL_CLASS}>Device state</label>
          <select
            className={SELECT_CLASS}
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
          >
            {DEVICE_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {productId && (
        <div className="rounded-md bg-slate-50 border border-border p-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span className="font-semibold text-foreground">{targetDevices.length} devices</span>
          <span className="text-muted-foreground">
            {wifiCount} WiFi &middot; {cellularCount} cellular
          </span>
          {selectedProduct?.isCellular && selectedFirmware && (
            <span className="text-amber-700 font-medium">
              ~{estimatedDataMb.toFixed(1)} MB total cellular data
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCreate}
          disabled={!productId || !firmwareId || targetDevices.length === 0 || isPending}
          className="h-9 px-3.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isPending ? "Creating..." : "Create OTA Job"}
        </button>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        {justCreated && !error && (
          <p className="text-xs text-emerald-600">Job created.</p>
        )}
      </div>
    </div>
  );
}

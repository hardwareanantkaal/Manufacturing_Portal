import { requireClient, getDevices, getProducts } from "@/lib/tenant";
import { Wifi, Signal } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { ScanDeviceDialog } from "@/components/scan-device-dialog";
import Link from "next/link";

const SELECT_CLASS =
  "h-8 rounded-md border border-input bg-white px-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";
const INPUT_CLASS =
  "h-8 rounded-md border border-input bg-white px-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30";
const LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string; state?: string; q?: string }>;
}) {
  const { clientId } = await requireClient();
  const { productId, state, q } = await searchParams;

  const [devices, products] = await Promise.all([
    getDevices(clientId, { productId, state, search: q }),
    getProducts(clientId),
  ]);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Devices</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every device registered under your account.
          </p>
        </div>
        <ScanDeviceDialog />
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-2 mb-6">
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Search</label>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Serial number"
            className={`${INPUT_CLASS} w-48`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Product</label>
          <select name="productId" defaultValue={productId ?? ""} className={SELECT_CLASS}>
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>State</label>
          <select name="state" defaultValue={state ?? ""} className={SELECT_CLASS}>
            <option value="">All states</option>
            <option value="flashed">flashed</option>
            <option value="shipped">shipped</option>
            <option value="active">active</option>
            <option value="offline">offline</option>
            <option value="rma">rma</option>
          </select>
        </div>
        <button
          type="submit"
          className="h-8 px-3.5 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-slate-200 transition-colors"
        >
          Filter
        </button>
        {(productId || state || q) && (
          <Link href="/devices" className="h-8 flex items-center text-sm text-primary hover:underline">
            Clear
          </Link>
        )}
      </form>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="h-9 px-3 text-left font-semibold">Serial</th>
              <th className="h-9 px-3 text-left font-semibold">Product</th>
              <th className="h-9 px-3 text-left font-semibold">Network</th>
              <th className="h-9 px-3 text-left font-semibold">Firmware</th>
              <th className="h-9 px-3 text-left font-semibold">State</th>
              <th className="h-9 px-3 text-left font-semibold">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id} className="border-t border-border hover:bg-slate-50/70 transition-colors">
                <td className="px-3 py-2.5">
                  <Link
                    href={`/devices/${d.mac}`}
                    className="font-mono text-xs font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    {d.serial}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-foreground">{d.product.name}</td>
                <td className="px-3 py-2.5">
                  {d.product.isCellular ? (
                    <span className="inline-flex items-center gap-1 font-mono text-xs text-foreground">
                      <Signal size={13} className="text-slate-500" />
                      {d.lastRssi != null ? `${d.lastRssi} dBm` : "—"}
                    </span>
                  ) : (
                    <Wifi size={13} className="text-slate-500" />
                  )}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                  {d.fwVersion ?? "—"}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={d.state} />
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {d.lastSeenAt ? d.lastSeenAt.toLocaleString() : "never"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {devices.length === 0 && (
          <p className="text-sm text-muted-foreground p-6 text-center">
            No devices match these filters.
          </p>
        )}
      </div>
    </div>
  );
}

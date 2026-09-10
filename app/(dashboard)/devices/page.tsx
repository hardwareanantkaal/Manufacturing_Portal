import { prisma } from "@/lib/prisma";
import { createDevice, deleteDevice } from "./actions";
import { Wifi, Signal } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import type { Prisma } from "@prisma/client";
import Link from "next/link";

import { DeviceQrDialog } from "./device-qr-dialog";

const SELECT_CLASS =
  "h-8 rounded-md border border-input bg-white px-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";
const INPUT_CLASS =
  "h-8 rounded-md border border-input bg-white px-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30";
const LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; productId?: string; state?: string }>;
}) {
  const { clientId, productId, state } = await searchParams;

  const where: Prisma.DeviceWhereInput = {
    ...(productId ? { productId } : {}),
    ...(clientId ? { product: { clientId } } : {}),
    ...(state ? { state } : {}),
  };

  const [devices, clients, products] = await Promise.all([
    prisma.device.findMany({
      where,
      orderBy: { flashedAt: "desc" },
      include: { product: { include: { client: true } } },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Devices</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every unit flashed, shipped, or in the field, with live network state.
        </p>
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-2 mb-3">
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Client</label>
          <select name="clientId" defaultValue={clientId ?? ""} className={SELECT_CLASS}>
            <option value="">All clients</option>
            {clients.map((c: (typeof clients)[number]) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Product</label>
          <select name="productId" defaultValue={productId ?? ""} className={SELECT_CLASS}>
            <option value="">All products</option>
            {products.map((p: (typeof products)[number]) => (
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
        {(clientId || productId || state) && (
          <Link
            href="/devices"
            className="h-8 flex items-center text-sm text-primary hover:underline"
          >
            Clear
          </Link>
        )}
      </form>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="h-9 px-3 text-left font-semibold">Serial</th>
              <th className="h-9 px-3 text-left font-semibold">MAC</th>
              <th className="h-9 px-3 text-left font-semibold">Client</th>
              <th className="h-9 px-3 text-left font-semibold">Product</th>
              <th className="h-9 px-3 text-left font-semibold">Network</th>
              <th className="h-9 px-3 text-left font-semibold">Firmware</th>
              <th className="h-9 px-3 text-left font-semibold">State</th>
              <th className="h-9 px-3 text-left font-semibold">Last Seen</th>
              <th className="h-9 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d: (typeof devices)[number]) => (
              <tr key={d.id} className="border-t border-border hover:bg-slate-50/70 transition-colors">
                <td className="px-3 py-2.5">
                  <Link
                    href={`/devices/${d.mac}`}
                    className="font-mono text-xs font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    {d.serial}
                  </Link>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{d.mac}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{d.product.client.name}</td>
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
                <td className="px-3 py-2.5 text-right flex items-center justify-end gap-2">
                  <DeviceQrDialog serial={d.serial} mac={d.mac} claimToken={d.claimToken} />
                  <form action={deleteDevice.bind(null, d.id)}>
                    <button className="text-xs font-medium text-rose-600 hover:text-rose-700 transition-colors">
                      Delete
                    </button>
                  </form>
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

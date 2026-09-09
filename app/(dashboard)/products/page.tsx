import { prisma } from "@/lib/prisma";
import { createProduct, deleteProduct } from "./actions";
import { Cpu, Wifi, Signal } from "lucide-react";
import Link from "next/link";

const SELECT_CLASS =
  "h-8 rounded-md border border-input bg-white px-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";
const INPUT_CLASS =
  "h-8 rounded-md border border-input bg-white px-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30";
const LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

export default async function ProductsPage() {
  const [products, clients] = await Promise.all([
    prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        client: true,
        _count: { select: { devices: true, firmwares: true } },
      },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Products</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Product lines defined per client, scoped to a chip family and network type.
        </p>
      </div>

      <form
        action={createProduct}
        className="flex flex-wrap items-end gap-2 mb-6 p-3 rounded-lg border border-border bg-card"
      >
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Client</label>
          <select name="clientId" required className={SELECT_CLASS}>
            <option value="">Select client</option>
            {clients.map((c: (typeof clients)[number]) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Product name</label>
          <input name="name" placeholder="Track Sensor v1" required className={`${INPUT_CLASS} w-48`} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Chip family</label>
          <select name="chipFamily" required className={SELECT_CLASS}>
            <option value="esp32">esp32</option>
            <option value="esp32s3">esp32s3</option>
            <option value="esp32c3">esp32c3</option>
            <option value="esp8266">esp8266</option>
          </select>
        </div>
        <label className="flex items-center gap-1.5 h-8 px-1 text-sm text-foreground">
          <input type="checkbox" name="isCellular" className="w-3.5 h-3.5 rounded border-input accent-primary" />
          Cellular
        </label>
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Modem model</label>
          <input name="modemModel" placeholder="A7672S" className={`${INPUT_CLASS} w-32`} />
        </div>
        <button
          type="submit"
          className="h-8 px-3.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Add Product
        </button>
      </form>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="h-9 px-3 text-left font-semibold">Name</th>
              <th className="h-9 px-3 text-left font-semibold">Client</th>
              <th className="h-9 px-3 text-left font-semibold">Chip Family</th>
              <th className="h-9 px-3 text-left font-semibold">Network</th>
              <th className="h-9 px-3 text-left font-semibold">Devices</th>
              <th className="h-9 px-3 text-left font-semibold">Firmwares</th>
              <th className="h-9 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p: (typeof products)[number]) => (
              <tr key={p.id} className="border-t border-border hover:bg-slate-50/70 transition-colors">
                <td className="px-3 py-2.5">
                  <Link
                    href={`/products/${p.id}`}
                    className="flex items-center gap-2 font-medium text-foreground hover:text-primary transition-colors"
                  >
                    <span className="flex items-center justify-center w-7 h-7 rounded-md bg-secondary text-secondary-foreground shrink-0">
                      <Cpu size={14} />
                    </span>
                    {p.name}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{p.client.name}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-foreground">{p.chipFamily}</td>
                <td className="px-3 py-2.5">
                  {p.isCellular ? (
                    <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-[11px] font-semibold">
                      <Signal size={11} />
                      {p.modemModel ?? "Cellular"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded-full border bg-slate-100 text-slate-600 border-slate-200 font-mono text-[11px] font-semibold">
                      <Wifi size={11} />
                      WiFi
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-semibold">
                    {p._count.devices}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-semibold">
                    {p._count.firmwares}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <form action={deleteProduct.bind(null, p.id)}>
                    <button className="text-xs font-medium text-rose-600 hover:text-rose-700 transition-colors">
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {products.length === 0 && (
          <p className="text-sm text-muted-foreground p-6 text-center">No products yet.</p>
        )}
      </div>
    </div>
  );
}

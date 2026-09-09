import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Building2, Cpu, CircuitBoard, RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";

async function StatTile({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ size?: number }>;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-card p-4 flex items-center justify-between hover:border-ring transition-colors"
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-2xl font-semibold text-foreground mt-1">{value}</p>
      </div>
      <span className="flex items-center justify-center w-9 h-9 rounded-md bg-secondary text-secondary-foreground">
        <Icon size={18} />
      </span>
    </Link>
  );
}

export default async function DashboardPage() {
  const session = await getSession();

  const [clientCount, productCount, deviceCount, runningJobCount, offlineCount, recentDevices] =
    await Promise.all([
      prisma.client.count(),
      prisma.product.count(),
      prisma.device.count(),
      prisma.otaJob.count({ where: { status: "running" } }),
      prisma.device.count({ where: { state: "offline" } }),
      prisma.device.findMany({
        orderBy: { flashedAt: "desc" },
        take: 5,
        include: { product: { include: { client: true } } },
      }),
    ]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">
          Welcome back, {session?.name ?? session?.email}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fleet overview across all clients and products.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatTile label="Clients" value={clientCount} icon={Building2} href="/clients" />
        <StatTile label="Products" value={productCount} icon={Cpu} href="/products" />
        <StatTile label="Devices" value={deviceCount} icon={CircuitBoard} href="/devices" />
        <StatTile label="Running OTA Jobs" value={runningJobCount} icon={RefreshCw} href="/ota" />
      </div>

      {offlineCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm px-4 py-3 mb-6 flex items-center gap-2">
          <TriangleAlert size={16} />
          {offlineCount} device{offlineCount === 1 ? "" : "s"} currently offline.
          <Link href="/devices?state=offline" className="font-medium underline">
            View
          </Link>
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">Recently Flashed</h2>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="h-9 px-3 text-left font-semibold">Serial</th>
                <th className="h-9 px-3 text-left font-semibold">Client</th>
                <th className="h-9 px-3 text-left font-semibold">Product</th>
                <th className="h-9 px-3 text-left font-semibold">Flashed</th>
              </tr>
            </thead>
            <tbody>
              {recentDevices.map((d) => (
                <tr key={d.id} className="border-t border-border hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs text-foreground">{d.serial}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{d.product.client.name}</td>
                  <td className="px-3 py-2.5 text-foreground">{d.product.name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {d.flashedAt.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentDevices.length === 0 && (
            <p className="text-sm text-muted-foreground p-6 text-center">No devices flashed yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

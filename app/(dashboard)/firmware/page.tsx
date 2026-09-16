import { prisma } from "@/lib/prisma";
import { deleteFirmware } from "./actions";
import { UploadForm } from "./upload-form";
import { CopyButton } from "@/components/copy-button";
import { FileCode2, Download } from "lucide-react";

export default async function FirmwarePage() {
  const [products, deviceCounts] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
      include: { firmwares: { orderBy: { createdAt: "desc" } } },
    }),
    prisma.device.groupBy({
      by: ["productId", "fwVersion"],
      _count: { _all: true },
    }),
  ]);

  const countFor = (productId: string, version: string) =>
    deviceCounts.find((d) => d.productId === productId && d.fwVersion === version)?._count
      ._all ?? 0;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Firmware</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Versioned binaries per product. OTA jobs can only target devices under the same
          product.
        </p>
      </div>

      <UploadForm products={products} />

      <div className="flex flex-col gap-6">
        {products.map((product) => (
          <section key={product.id}>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-md bg-secondary text-secondary-foreground shrink-0">
                <FileCode2 size={14} />
              </span>
              {product.name}
            </h2>
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="h-9 px-3 text-left font-semibold">Version</th>
                    <th className="h-9 px-3 text-left font-semibold">Size</th>
                    <th className="h-9 px-3 text-left font-semibold">SHA-256</th>
                    <th className="h-9 px-3 text-left font-semibold">Uploaded</th>
                    <th className="h-9 px-3 text-left font-semibold">Devices on this version</th>
                    <th className="h-9 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {product.firmwares.map((f) => {
                    const sizeMb = f.sizeBytes / 1024 / 1024;
                    return (
                      <tr
                        key={f.id}
                        className="border-t border-border hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="px-3 py-2.5 font-mono text-xs font-semibold text-foreground">
                          {f.version}
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold uppercase">
                            {f.channel}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                          {sizeMb.toFixed(2)} MB
                          {product.isCellular && (
                            <div className="text-[11px] text-amber-700 mt-0.5">
                              ~{sizeMb.toFixed(2)} MB / device over cellular
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                            {f.sha256.slice(0, 12)}…
                            <CopyButton value={f.sha256} title="Copy full SHA-256" />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {f.createdAt.toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-semibold">
                            {countFor(product.id, f.version)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right flex items-center justify-end gap-2">
                          <a
                            href={`/firmware/${f.id}/download`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                          >
                            <Download size={13} />
                            Download
                          </a>
                          <form action={deleteFirmware.bind(null, f.id)}>
                            <button className="text-xs font-medium text-rose-600 hover:text-rose-700 transition-colors">
                              Delete
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {product.firmwares.length === 0 && (
                <p className="text-sm text-muted-foreground p-6 text-center">
                  No firmware uploaded yet.
                </p>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

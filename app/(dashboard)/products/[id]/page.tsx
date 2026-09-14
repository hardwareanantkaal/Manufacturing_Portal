import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Wifi, Signal, KeyRound } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { CopyButton } from "@/components/copy-button";
import { ProductSettingsForm } from "./product-settings-form";
import { RegenerateKeyButton } from "./regenerate-key-button";
import { ApiKeyDisplay } from "./api-key-display";
import type { DetectedField } from "./sensor-schema-editor";
import type { SensorField } from "@/lib/sensor-schema";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      client: true,
      devices: { orderBy: { flashedAt: "desc" } },
      firmwares: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!product) notFound();

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const dataUrl = `${origin}/api/v1/data/${product.productKey}`;
  const otaUrl = `${origin}/api/v1/ota/${product.productKey}`;
  const sensorSchema = (product.sensorSchema as SensorField[] | null) ?? [];

  // What admins actually pick from in the "select which data is received"
  // field picker — real numeric keys seen in devices' latest payloads, so
  // schema entries come from what's really arriving instead of hand-typed
  // (and possibly mistyped) key names.
  const configuredKeys = new Set(sensorSchema.map((f) => f.key.toLowerCase()));
  const detectedFieldsMap = new Map<string, number>();
  for (const device of product.devices) {
    const payload = device.lastPayload as Record<string, unknown> | null;
    if (!payload) continue;
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value === "number" && !configuredKeys.has(key.toLowerCase())) {
        detectedFieldsMap.set(key, value);
      }
    }
  }
  const detectedFields: DetectedField[] = [...detectedFieldsMap.entries()].map(([key, sample]) => ({
    key,
    sample,
  }));

  const sampleMac = product.devices[0]?.mac ?? "AABBCCDDEEFF";
  // One line, no \ or ` continuations — those differ between PowerShell and
  // Bash, so a single line is the only form that pastes correctly into both.
  const curlExample = `curl.exe -X POST ${dataUrl} -H "x-api-key: ${product.apiKey}" -H "Content-Type: application/json" -d '{"mac":"${sampleMac}","payload":{${sensorSchema[0] ? `"${sensorSchema[0].key}":0` : '"temp":0'}}}'`;

  const esp32Snippet = `#define SERVER      "${origin}"   // use your LAN IP for local testing, not localhost
#define PRODUCT_KEY "${product.productKey}"
#define API_KEY     "${product.apiKey}"`;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">{product.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">{product.client.name}</p>
        <div className="flex gap-2 mt-3">
          <span className="inline-flex items-center h-5 px-2 rounded-full border bg-slate-100 text-slate-600 border-slate-200 font-mono text-[11px] font-semibold">
            {product.chipFamily}
          </span>
          {product.isCellular ? (
            <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-[11px] font-semibold">
              <Signal size={11} />
              {product.modemModel ?? "Cellular"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded-full border bg-slate-100 text-slate-600 border-slate-200 font-mono text-[11px] font-semibold">
              <Wifi size={11} />
              WiFi
            </span>
          )}
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
          <KeyRound size={14} className="text-primary" />
          Device API
        </h2>
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0 w-24">
              Product Key
            </span>
            <code className="flex-1 font-mono text-xs text-foreground truncate">{product.productKey}</code>
            <CopyButton value={product.productKey} title="Copy product key" />
          </div>

          <ApiKeyDisplay apiKey={product.apiKey} />
          <div className="flex justify-end -mt-1">
            <RegenerateKeyButton productId={product.id} productName={product.name} />
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0 w-24">
              Data endpoint
            </span>
            <code className="flex-1 font-mono text-xs text-foreground truncate">{dataUrl}</code>
            <CopyButton value={dataUrl} title="Copy data endpoint URL" />
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0 w-24">
              OTA endpoint
            </span>
            <code className="flex-1 font-mono text-xs text-foreground truncate">{otaUrl}</code>
            <CopyButton value={otaUrl} title="Copy OTA endpoint URL" />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="p-3 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                curl example (paste into PowerShell to test)
              </span>
              <CopyButton value={curlExample} title="Copy curl example" />
            </div>
            <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all bg-slate-50 rounded-md p-2.5">
{curlExample}
            </pre>
          </div>
          <div className="p-3 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                ESP32 / ESP8266 config snippet
              </span>
              <CopyButton value={esp32Snippet} title="Copy firmware snippet" />
            </div>
            <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all bg-slate-50 rounded-md p-2.5">
{esp32Snippet}
            </pre>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-foreground mb-3">Product settings</h2>
        <ProductSettingsForm
          productId={product.id}
          productKey={product.productKey}
          readInterval={product.readInterval}
          sensorSchema={sensorSchema}
          detectedFields={detectedFields}
        />
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-foreground mb-3">Devices</h2>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="h-9 px-3 text-left font-semibold">Serial</th>
                <th className="h-9 px-3 text-left font-semibold">MAC</th>
                <th className="h-9 px-3 text-left font-semibold">State</th>
                <th className="h-9 px-3 text-left font-semibold">Firmware</th>
              </tr>
            </thead>
            <tbody>
              {product.devices.map((d: (typeof product.devices)[number]) => (
                <tr key={d.id} className="border-t border-border hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs text-foreground">{d.serial}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-foreground">{d.mac}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={d.state} />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                    {d.fwVersion ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {product.devices.length === 0 && (
            <p className="text-sm text-muted-foreground p-6 text-center">No devices yet.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">Firmware</h2>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="h-9 px-3 text-left font-semibold">Version</th>
                <th className="h-9 px-3 text-left font-semibold">Channel</th>
                <th className="h-9 px-3 text-left font-semibold">Size</th>
                <th className="h-9 px-3 text-left font-semibold">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {product.firmwares.map((f: (typeof product.firmwares)[number]) => (
                <tr key={f.id} className="border-t border-border hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs font-semibold text-foreground">{f.version}</td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-semibold">
                      {f.channel}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                    {(f.sizeBytes / 1024 / 1024).toFixed(2)} MB
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{f.createdAt.toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {product.firmwares.length === 0 && (
            <p className="text-sm text-muted-foreground p-6 text-center">No firmware uploaded yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

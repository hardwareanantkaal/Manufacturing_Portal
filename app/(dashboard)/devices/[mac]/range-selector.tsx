import Link from "next/link";

const RANGES = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
] as const;

export function RangeSelector({ mac, current }: { mac: string; current: string }) {
  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden">
      {RANGES.map((r) => (
        <Link
          key={r.value}
          href={`/devices/${mac}?range=${r.value}`}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            current === r.value
              ? "bg-primary text-primary-foreground"
              : "bg-white text-muted-foreground hover:bg-slate-50"
          }`}
        >
          {r.label}
        </Link>
      ))}
    </div>
  );
}

import Link from "next/link";

const PRESETS = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
] as const;

const INPUT_CLASS =
  "h-8 rounded-md border border-input bg-white px-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

export function RangeSelector({
  mac,
  current,
  customFrom,
  customTo,
}: {
  mac: string;
  current: string;
  customFrom?: string;
  customTo?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex rounded-md border border-border overflow-hidden">
        {PRESETS.map((r) => (
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
      <form method="get" action={`/devices/${mac}`} className="flex items-center gap-1.5">
        <input type="hidden" name="range" value="custom" />
        <input type="date" name="from" defaultValue={customFrom} className={INPUT_CLASS} />
        <span className="text-xs text-muted-foreground">to</span>
        <input type="date" name="to" defaultValue={customTo} className={INPUT_CLASS} />
        <button
          type="submit"
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            current === "custom"
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-white text-muted-foreground hover:bg-slate-50"
          }`}
        >
          Custom
        </button>
      </form>
    </div>
  );
}
